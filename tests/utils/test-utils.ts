import fs from 'fs';
import path from 'path';
import { TEST_TEMP_DIR } from '../setup';

// 重新导出 TEST_TEMP_DIR 以供其他模块使用
export { TEST_TEMP_DIR };

/**
 * 创建测试文件
 */
export function createTestFile(fileName: string, content: string = 'test content'): string {
  const filePath = path.join(TEST_TEMP_DIR, fileName);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * 创建测试目录
 */
export function createTestDir(dirName: string): string {
  const dirPath = path.join(TEST_TEMP_DIR, dirName);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * 清理测试文件
 */
export function cleanupTestFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * 清理测试目录
 */
export function cleanupTestDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {
      // 忽略清理错误，可能文件正在使用中
      // 这在 Windows 上很常见
    }
  }
}

/**
 * 读取文件内容
 */
export function readTestFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 检查文件是否存在
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * 等待指定时间（毫秒）
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 生成随机任务ID
 */
export function generateTestTaskId(): string {
  return `test-task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
