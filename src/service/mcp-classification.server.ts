import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import OpenAI from "openai";
import { config } from "../config.js";
import { aiLogger } from "../logger.js";

// 创建 MCP 分类服务器
const server = new McpServer({
  name: "file-classification-server",
  version: "1.0.0"
});

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
  baseURL: config.OPENAI_BASE_URL || undefined,
  defaultHeaders: {
    "APP-Code": "TRGU7082",
  },
});

// 注册批量分类工具
server.registerTool(
  "classify_files_batch",
  {
    title: "批量文件分类工具",
    description: "根据文件信息智能批量分类多个文件到合适的目录",
    inputSchema: {
      files: z.array(z.object({
        fileName: z.string().describe("文件名"),
        description: z.string().describe("文件描述信息")
      })).describe("待分类的文件列表"),
      knownDirs: z.array(z.string()).describe("现有目录结构列表")
    }
  },
  async ({ files, knownDirs }) => {
    try {
      if (files.length === 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify([])
          }]
        };
      }

      // 构建批量分类的上下文
      const filesList = files
        .map(
          (file, index) =>
            `${index + 1}. ${file.fileName}${file.description ? ` - ${file.description}` : ""}`
        )
        .join("\n");

      const contextInfo = `现有目录结构:\n${
        knownDirs.length > 0
          ? knownDirs.map((dir) => `  ${dir}`).join("\n")
          : "暂无，需要创建新目录"
      }\n待分类文件列表:\n${filesList}`;

      aiLogger.info({ contextInfo }, `批量AI分类请求 - 文件数量: ${files.length}`);

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
                        reasoning: {
                          type: "string",
                          description: "分类理由",
                        },
                      },
                      required: ["file_name", "directory_path", "reasoning"],
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

      // 记录 AI 原始响应的关键元信息
      try {
        aiLogger.info(
          {
            ai_response_meta: {
              id: (res as any)?.id,
              model: (res as any)?.model,
              usage: (res as any)?.usage,
            },
          },
          "收到 AI 响应"
        );
      } catch {}

      const choice = res.choices?.[0];
      
      try {
        aiLogger.info({ ai_message: choice?.message }, "AI 返回消息");
      } catch {}
      
      if (choice?.message?.tool_calls?.[0]) {
        const toolCall = choice.message.tool_calls[0];
        if (toolCall.type === "function" && toolCall.function.name === "classify_files_batch") {
          try {
            try {
              aiLogger.info(
                {
                  ai_tool_call: {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments,
                  },
                },
                "AI 工具调用返回"
              );
            } catch {}
            
            const result = JSON.parse(toolCall.function.arguments);
            const classifications = result.classifications || [];

            aiLogger.info(`批量分类完成，处理了 ${classifications.length} 个文件`);
            
            try {
              aiLogger.info({ classifications }, "AI 分类原始结果");
            } catch {}

            const formattedResults = classifications.map((item: any) => ({
              fileName: item.file_name,
              path: item.directory_path,
              reasoning: item.reasoning,
            }));

            return {
              content: [{
                type: "text",
                text: JSON.stringify(formattedResults)
              }]
            };
          } catch (parseError) {
            aiLogger.error(`解析批量分类结果失败: ${parseError}`);
            throw new Error(`批量分类解析失败: ${parseError}`);
          }
        }
      }

      throw new Error("AI批量分类失败：未返回有效结果");
    } catch (error) {
      aiLogger.error(`批量分类失败: ${error}`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: `分类失败: ${error}` })
        }],
        isError: true
      };
    }
  }
);

/**
 * 获取批量分类系统提示
 */
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

## 决策流程
1. 查看现有目录列表
2. 判断文件类型和用途
3. 寻找最合适的现有目录
4. 如没有合适的现有目录则创建新目录

批量处理时要保持分类的一致性和逻辑性。`;
}

// 启动 MCP 服务器（仅在直接运行此文件时）
if (import.meta.main) {
  async function main() {
    try {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      aiLogger.info("MCP 文件分类服务器启动成功");
    } catch (error) {
      aiLogger.error(`MCP 服务器启动失败: ${error}`);
      process.exit(1);
    }
  }

  main();
}

export { server as mcpClassificationServer };