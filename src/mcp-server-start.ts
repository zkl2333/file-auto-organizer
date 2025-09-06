#!/usr/bin/env node

import { mcpClassificationServer } from "./service/mcp-classification.server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { aiLogger } from "./logger.js";

async function main() {
  try {
    const transport = new StdioServerTransport();
    await mcpClassificationServer.connect(transport);
    
    aiLogger.info("MCP 文件分类服务器启动成功");
    
    // 保持进程运行
    process.on('SIGINT', () => {
      aiLogger.info("收到 SIGINT，正在关闭 MCP 服务器...");
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      aiLogger.info("收到 SIGTERM，正在关闭 MCP 服务器...");
      process.exit(0);
    });
    
  } catch (error) {
    aiLogger.error(`MCP 服务器启动失败: ${error}`);
    process.exit(1);
  }
}

// 确保这个文件被直接运行时启动服务器
main();