import { aiLogger } from "../logger.js";
import { mcpClient, MCPClientService } from "./mcp-client.service.js";

export class AIClassificationService {
  private mcpClient: MCPClientService;

  constructor() {
    this.mcpClient = mcpClient;
  }

  /**
   * 批量分类函数（主要功能）
   * 现在使用 MCP (模型上下文协议) 进行通信
   */
  async classifyBatch(
    files: Array<{ fileName: string; description: string }>,
    knownDirs: string[]
  ): Promise<Array<{ fileName: string; path: string; reasoning?: string }>> {
    try {
      if (files.length === 0) return [];

      aiLogger.info({ filesCount: files.length, knownDirsCount: knownDirs.length }, 
        `使用 MCP 进行批量分类 - 文件数量: ${files.length}`);

      // 使用 MCP 客户端调用分类工具
      const classifications = await this.mcpClient.classifyFilesBatch(files, knownDirs);

      aiLogger.info(`MCP 批量分类完成，处理了 ${classifications.length} 个文件`);
      
      return classifications;
    } catch (error) {
      aiLogger.error(`MCP 批量分类失败: ${error}`);
      throw error;
    }
  }

  /**
   * 获取 MCP 服务器状态
   */
  async getMCPStatus(): Promise<{ connected: boolean; serverInfo?: any }> {
    try {
      const connected = await this.mcpClient.checkStatus();
      if (connected) {
        const serverInfo = await this.mcpClient.getServerInfo();
        return { connected, serverInfo };
      }
      return { connected };
    } catch (error) {
      aiLogger.error(`获取 MCP 服务器状态失败: ${error}`);
      return { connected: false };
    }
  }

  /**
   * 断开 MCP 连接（清理资源时使用）
   */
  async disconnect(): Promise<void> {
    await this.mcpClient.disconnect();
  }
}
