/**
 * Bun 测试全局设置文件
 * 在所有测试运行前执行的配置
 */

import { beforeAll, afterAll } from "bun:test";

// 全局测试设置
beforeAll(async () => {
  // 设置测试环境变量
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "error"; // 减少测试时的日志输出
  
  // 确保测试目录存在
  await Bun.write("tests/fixtures/.gitkeep", "");
});

// 全局清理
afterAll(async () => {
  // 测试完成后的清理工作
  console.log("✅ 所有测试完成");
});

// 导出测试工具函数
export function createTestFile(path: string, content: string): Promise<number> {
  return Bun.write(path, content);
}

export function removeTestFile(path: string): Promise<void> {
  return Bun.unlink(path).catch(() => {
    // 文件不存在时忽略错误
  });
}

