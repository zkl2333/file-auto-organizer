import { beforeAll, afterAll, vi } from 'vitest';
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
    console.error('清理测试目录失败', error);
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

// ===== 公共 Mock 定义 =====

// Mock fs
vi.mock('node:fs');
export const mockedFs = vi.mocked(require('node:fs'));

// Mock config (避免 await import 导致的问题)
export const mockedGetConfig = vi.fn(() => ({
  logging: { level: 'info', dir: TEST_LOGS_DIR },
  auth: {
    jwt_secret: 'test-secret',
    jwt_refresh_secret: 'test-refresh-secret',
    admin_username: 'admin',
    admin_password: 'hashed-password',
  },
  openai: { api_key: 'test', model: 'test', base_url: 'test' },
  directories: { root_dir: '', incoming_dir: '' },
  cron: { enabled: false, schedule: '' },
  timezone: '',
  scan: { max_depth: 0, similarity_threshold: 0 },
  ai: { batch_size: 0 },
  file_operations: { max_retries: 0, retry_delay_base: 0 },
}));

// Mock logger
vi.mock('@/lib/logger');
export const mockedLogger = vi.mocked(await import('@/lib/logger')).logger;

// Mock getConfig
vi.mock('@/lib/config');
export const mockGetConfigModule = await import('@/lib/config');

beforeAll(() => {
  cleanupTestDirs();
  createTestDirs();
});

afterAll(() => {
  cleanupTestDirs();
});

// 导出测试工具函数
export { TEST_TEMP_DIR, TEST_LOGS_DIR, cleanupTestDirs, createTestDirs };
