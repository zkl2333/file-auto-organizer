import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { aiLogger } from "../logger.js";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MCPClientService {
  private client?: Client;
  private transport?: StdioClientTransport;
  private isConnected = false;

  /**
   * 连接到 MCP 分类服务器
   */
  async connect(): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        return;
      }

      aiLogger.info("正在连接到 MCP 分类服务器...");

      // 创建客户端传输，连接到分类服务器
      const serverPath = path.join(path.dirname(__dirname), "mcp-server-start.js");
      this.transport = new StdioClientTransport({
        command: "node",
        args: [serverPath]
      });

      this.client = new Client(
        {
          name: "file-organizer-client",
          version: "1.0.0"
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      await this.client.connect(this.transport);
      this.isConnected = true;
      
      aiLogger.info("成功连接到 MCP 分类服务器");
    } catch (error) {
      aiLogger.error(`连接 MCP 服务器失败: ${error}`);
      throw error;
    }
  }

  /**
   * 断开与 MCP 服务器的连接
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = undefined;
      }
      
      if (this.transport) {
        await this.transport.close();
        this.transport = undefined;
      }
      
      this.isConnected = false;
      aiLogger.info("已断开 MCP 服务器连接");
    } catch (error) {
      aiLogger.error(`断开 MCP 服务器连接时出错: ${error}`);
    }
  }

  /**
   * 调用批量分类工具
   */
  async classifyFilesBatch(
    files: Array<{ fileName: string; description: string }>,
    knownDirs: string[]
  ): Promise<Array<{ fileName: string; path: string; reasoning?: string }>> {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }

    try {
      aiLogger.info({ filesCount: files.length }, "调用 MCP 批量分类工具");

      const result = await this.client!.callTool({
        name: "classify_files_batch",
        arguments: {
          files,
          knownDirs
        }
      });

      // 解析返回结果
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const content = result.content[0];
        if (content && content.type === "text") {
          try {
            const classifications = JSON.parse(content.text);
            
            // 检查是否有错误
            if (classifications.error) {
              throw new Error(classifications.error);
            }
            
            aiLogger.info({ classificationsCount: classifications.length }, "MCP 批量分类完成");
            return classifications;
          } catch (parseError) {
            aiLogger.error(`解析 MCP 分类结果失败: ${parseError}`);
            throw new Error(`解析分类结果失败: ${parseError}`);
          }
        }
      }

      throw new Error("MCP 工具未返回有效结果");
    } catch (error) {
      aiLogger.error(`MCP 批量分类调用失败: ${error}`);
      
      // 如果是连接错误，尝试重新连接
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("connection") || errorMessage.includes("transport")) {
        this.isConnected = false;
        await this.disconnect();
        throw new Error("MCP 服务器连接中断，请重试");
      }
      
      throw error;
    }
  }

  /**
   * 检查 MCP 服务器状态
   */
  async checkStatus(): Promise<boolean> {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      // 尝试列出可用工具来检查连接状态
      const tools = await this.client.listTools();
      return tools.tools.some(tool => tool.name === "classify_files_batch");
    } catch (error) {
      aiLogger.error(`检查 MCP 服务器状态失败: ${error}`);
      return false;
    }
  }

  /**
   * 获取 MCP 服务器信息
   */
  async getServerInfo(): Promise<any> {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }

    try {
      const tools = await this.client!.listTools();
      const resources = await this.client!.listResources();
      const prompts = await this.client!.listPrompts();

      return {
        tools: tools.tools,
        resources: resources.resources,
        prompts: prompts.prompts
      };
    } catch (error) {
      aiLogger.error(`获取 MCP 服务器信息失败: ${error}`);
      throw error;
    }
  }
}

// 创建单例实例
export const mcpClient = new MCPClientService();