import OpenAI from "openai";
import { config } from "./config.js";
import { logger } from "./logger.js";

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
  baseURL: config.OPENAI_BASE_URL || undefined,
  defaultHeaders: {
    "APP-Code": "TRGU7082",
  },
});

// 批量分类函数（主要功能）
export async function aiClassifyBatch(
  files: Array<{ fileName: string; description: string }>,
  knownDirs: string[]
): Promise<Array<{ fileName: string; path: string; confidence: number; reasoning?: string }>> {
  try {
    if (files.length === 0) return [];

    // 构建批量分类的上下文
    const filesList = files
      .map(
        (file, index) =>
          `${index + 1}. ${file.fileName}${file.description ? ` - ${file.description}` : ""}`
      )
      .join("\n");

    const contextInfo = `现有目录结构:
${knownDirs.length > 0 ? knownDirs.map((dir) => `  ${dir}`).join("\n") : "  暂无，需要创建新目录"}

待分类文件列表:
${filesList}

请为每个文件选择最佳的分类目录。`;

    logger.info(`批量AI分类请求 - 文件数量: ${files.length}`);

    const res = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: getBatchSystemPrompt(),
        },
        {
          role: "user",
          content: contextInfo,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classify_files_batch",
            description: "批量分类多个文件",
            parameters: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      file_name: {
                        type: "string",
                        description: "文件名",
                      },
                      directory_path: {
                        type: "string",
                        description: "分类目录路径",
                      },
                      confidence: {
                        type: "number",
                        minimum: 0.1,
                        maximum: 1.0,
                        description: "置信度",
                      },
                      reasoning: {
                        type: "string",
                        description: "分类理由",
                      },
                    },
                    required: ["file_name", "directory_path", "confidence", "reasoning"],
                  },
                },
              },
              required: ["classifications"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classify_files_batch" } },
      temperature: 0.1,
    });

    const choice = res.choices?.[0];
    if (choice?.message?.tool_calls?.[0]) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.type === "function" && toolCall.function.name === "classify_files_batch") {
        try {
          const result = JSON.parse(toolCall.function.arguments);
          const classifications = result.classifications || [];

          logger.info(`批量分类完成，处理了 ${classifications.length} 个文件`);

          return classifications.map((item: any) => ({
            fileName: item.file_name,
            path: item.directory_path,
            confidence: item.confidence,
            reasoning: item.reasoning,
          }));
        } catch (parseError) {
          logger.error(`解析批量分类结果失败: ${parseError}`);
          throw new Error(`批量分类解析失败: ${parseError}`);
        }
      }
    }

    throw new Error("AI批量分类失败：未返回有效结果");
  } catch (error) {
    logger.error(`批量分类失败: ${error}`);
    throw error;
  }
}

// 获取批量分类系统提示
function getBatchSystemPrompt(): string {
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

批量处理时要保持分类的一致性和逻辑性。`;
}
