/**
 * Vitest 测试全局设置文件 - 统一配置和mock
 * 优化版：减少重复代码、统一测试模式
 */

import { vi, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import { TestUtils } from './utils/test-utils.js';

// Mock exiftool-vendored - 统一配置
vi.mock('exiftool-vendored', () => ({
  exiftool: {
    read: vi.fn(() => Promise.resolve({
      Title: 'Test Title',
      Author: 'Test Author',
      Description: 'Test Description',
      Software: 'Test Software',
      Keywords: 'test, metadata, extraction',
      Subject: 'Test Subject',
      CreateDate: '2023-01-01T00:00:00',
      ModifyDate: '2023-01-01T00:00:00'
    })),
    end: vi.fn(() => Promise.resolve())
  }
}));

// Mock logger - 统一配置
vi.mock('../src/logger.js', () => ({
  fileInfoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  mainLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  statsLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// 全局测试设置
beforeAll(async () => {
  // 设置测试环境变量
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "error"; // 减少测试时的日志输出

  // 确保测试目录存在
  TestUtils.ensureFixturesDir();
  await fs.writeFile("tests/fixtures/.gitkeep", "");
});

// 全局清理
afterAll(async () => {
  // 使用TestUtils进行清理
  TestUtils.cleanup();

  // 测试完成后的清理工作
  console.log("✅ 所有测试完成");
});

// 导出测试工具函数 - 保持向后兼容
export async function createTestFile(path: string, content: string): Promise<void> {
  await fs.writeFile(path, content, "utf-8");
}

export async function removeTestFile(path: string): Promise<void> {
  try {
    await fs.unlink(path);
  } catch {
    // 文件不存在时忽略错误
  }
}

// 导出TestUtils供测试使用
export { TestUtils };
