import { beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// 测试用的临时目录
const TEST_TEMP_DIR = path.join(process.cwd(), 'test-temp');
const TEST_LOGS_DIR = path.join(process.cwd(), 'test-logs');

// 清理测试环境
function cleanupTestDirs() {
  try {
    if (fs.existsSync(TEST_TEMP_DIR)) {
      fs.rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(TEST_LOGS_DIR)) {
      fs.rmSync(TEST_LOGS_DIR, { recursive: true, force: true });
    }
  } catch (error) {
    // 忽略清理错误，可能文件正在使用中（Windows 常见问题）
  }
}

// 创建测试目录
function createTestDirs() {
  if (!fs.existsSync(TEST_TEMP_DIR)) {
    fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_LOGS_DIR)) {
    fs.mkdirSync(TEST_LOGS_DIR, { recursive: true });
  }
}

beforeAll(() => {
  cleanupTestDirs();
  createTestDirs();
});

afterAll(() => {
  cleanupTestDirs();
});

beforeEach(() => {
  // 每个测试前清理临时文件
  cleanupTestDirs();
  createTestDirs();
});

// 导出测试工具函数
export { TEST_TEMP_DIR, TEST_LOGS_DIR, cleanupTestDirs, createTestDirs };
