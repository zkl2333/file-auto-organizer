import OpenAI from 'openai';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

/**
 * AI分类结果类型
 */
interface ClassificationResult {
  file_name: string;
  directory_path: string;
  reasoning?: string;
}

/**
 * AI分类服务
 */
export class AIClassificationService {
  private openai: OpenAI;

  constructor() {
    const config = getConfig();
    this.openai = new OpenAI({
      apiKey: config.openai.api_key,
      baseURL: config.openai.base_url || undefined,
    });
  }

  /**
   * 批量分类文件
   */
  async classifyBatch(
    files: Array<{ fileName: string; description: string }>,
    knownDirs: string[]
  ): Promise<{
    classifications: Array<{ fileName: string; path: string; reasoning?: string }>;
    tokensUsed: number;
  }> {
    const startTime = Date.now();

    try {
      if (files.length === 0) return { classifications: [], tokensUsed: 0 };

      // 构建批量分类的上下文
      const filesList = files
        .map(
          (file, index) =>
            `${index + 1}. ${file.fileName}${file.description ? ` - ${file.description}` : ''}`
        )
        .join('\n');

      const contextInfo = `现有目录结构:\n${
        knownDirs.length > 0
          ? knownDirs.map((dir) => `  ${dir}`).join('\n')
          : '暂无，需要创建新目录'
      }\n待分类文件列表:\n${filesList}`;

      // 记录请求详情
      const filesSample = files.slice(0, 3).map((f) => f.fileName);
      const hasMore = files.length > 3;
      logger.info(
        {
          module: 'ai',
          totalFiles: files.length,
          totalDirs: knownDirs.length,
          filesSample,
          hasMore,
        },
        `开始AI分类: ${files.length}个文件, ${knownDirs.length}个已有目录`
      );

      const config = getConfig();
      const res = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: this.getBatchSystemPrompt(),
          },
          {
            role: 'user',
            content: contextInfo,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'classify_files_batch',
              description: '批量分类多个文件',
              parameters: {
                type: 'object',
                properties: {
                  classifications: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        file_name: {
                          type: 'string',
                          description: '文件名',
                        },
                        directory_path: {
                          type: 'string',
                          description: '分类目录路径',
                        },
                        reasoning: {
                          type: 'string',
                          description: '分类理由',
                        },
                      },
                      required: ['file_name', 'directory_path', 'reasoning'],
                    },
                  },
                },
                required: ['classifications'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'classify_files_batch' } },
        temperature: 0.1,
      });

      const usage = res.usage;

      const choice = res.choices?.[0];
      if (choice?.message?.tool_calls?.[0]) {
        const toolCall = choice.message.tool_calls[0];
        if (toolCall.type === 'function' && toolCall.function.name === 'classify_files_batch') {
          try {
            const result = JSON.parse(toolCall.function.arguments) as {
              classifications: ClassificationResult[];
            };
            const classifications = result.classifications || [];
            const tokensUsed = usage?.total_tokens || 0;
            const elapsedMs = Date.now() - startTime;

            // 统计新旧目录
            const uniqueDirs = new Set(classifications.map((c) => c.directory_path));
            const newDirs = Array.from(uniqueDirs).filter(
              (dir) => !knownDirs.includes(dir as string)
            );

            // 选择前3个分类结果作为示例
            const classificationsSample = classifications.slice(0, 3).map((c) => ({
              file: c.file_name,
              dir: c.directory_path,
              reason: c.reasoning
                ? c.reasoning.substring(0, 50) + (c.reasoning.length > 50 ? '...' : '')
                : '',
            }));

            logger.info(
              {
                module: 'ai',
                classified: classifications.length,
                tokens: tokensUsed,
                promptTokens: usage?.prompt_tokens || 0,
                completionTokens: usage?.completion_tokens || 0,
                elapsedMs,
                avgMsPerFile: Math.round(elapsedMs / files.length),
                uniqueDirs: uniqueDirs.size,
                newDirs: newDirs.length,
                existingDirs: uniqueDirs.size - newDirs.length,
                sample: classificationsSample,
              },
              `AI分类完成: ${classifications.length}个文件分类到${uniqueDirs.size}个目录 (耗时${elapsedMs}ms, ${tokensUsed} tokens)`
            );

            // 仅在 debug 级别记录完整分类结果
            logger.debug({ module: 'ai', classifications }, '完整分类结果');

            return {
              classifications: classifications.map((item) => ({
                fileName: item.file_name,
                path: item.directory_path,
                reasoning: item.reasoning,
              })),
              tokensUsed,
            };
          } catch (parseError) {
            const elapsedMs = Date.now() - startTime;
            logger.error(
              {
                module: 'ai',
                error: parseError,
                elapsedMs,
                rawArguments: toolCall.function.arguments?.substring(0, 200),
              },
              `解析分类结果失败 (耗时${elapsedMs}ms)`
            );
            throw new Error(`批量分类解析失败: ${parseError}`);
          }
        }
      }

      const elapsedMs = Date.now() - startTime;
      logger.error(
        {
          module: 'ai',
          elapsedMs,
          hasChoice: !!choice,
          hasToolCalls: !!choice?.message?.tool_calls,
          toolCallsCount: choice?.message?.tool_calls?.length || 0,
        },
        `AI分类失败：未返回有效结果 (耗时${elapsedMs}ms)`
      );
      throw new Error('AI批量分类失败：未返回有效结果');
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRateLimitError = errorMessage.includes('rate_limit') || errorMessage.includes('429');
      const isAPIError = errorMessage.includes('API') || errorMessage.includes('timeout');

      logger.error(
        {
          module: 'ai',
          error,
          errorType: isRateLimitError ? 'rate_limit' : isAPIError ? 'api_error' : 'unknown',
          filesCount: files.length,
          elapsedMs,
        },
        `批量分类失败: ${errorMessage} (耗时${elapsedMs}ms)`
      );
      throw error;
    }
  }

  /**
   * 获取批量分类系统提示
   */
  private getBatchSystemPrompt(): string {
    return `你是一个专业的文件批量分类专家，擅长根据文件信息智能分类。

## 核心能力
1. **语义理解**：深度理解文件名和描述的含义
2. **模式识别**：识别文件类型和分类规律
3. **一致性分类**：为相似文件保持一致的分类逻辑
4. **智能决策**：提供高质量的分类决策和理由

## 分类原则
- **一致性优先**：优先使用现有目录结构
- **语义分类**：基于文件实际用途而非仅仅文件名
- **层级合理**：保持适当的目录层级深度
- **中文命名**：使用简洁直观的中文目录名

## 分类策略
- 安装包按软件类型分类（开发工具、效率工具、系统工具等）
- 文档按内容性质分类（技术文档、工作文档、个人资料等）
- 媒体文件按格式和用途分类
- 压缩包按内容推测进行分类

## 决策流程
1. 查看现有目录列表
2. 判断文件类型和用途
3. 寻找最合适的现有目录
4. 如没有合适的现有目录则创建新目录

批量处理时要保持分类的一致性和逻辑性。`;
  }
}
