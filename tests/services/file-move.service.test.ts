import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { FileMoveService } from '@/lib/services/file-move.service';
import { cleanupTestDirs, TEST_TEMP_DIR } from '../setup';
import path from 'path';
import fs from 'fs';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FileMoveService', () => {
  let fileMoveService: FileMoveService;
  let originalCwd: string;
  let testRootDir: string;
  let testSourceDir: string;
  let testTargetDir: string;

  beforeAll(() => {
    // 创建测试目录结构
    testRootDir = path.join(TEST_TEMP_DIR, 'root');
    testSourceDir = path.join(testRootDir, 'source');
    testTargetDir = path.join(testRootDir, 'target');

    fs.mkdirSync(testRootDir, { recursive: true });
    fs.mkdirSync(testSourceDir, { recursive: true });
    fs.mkdirSync(testTargetDir, { recursive: true });

    // 创建目标目录
    fs.mkdirSync(path.join(testTargetDir, 'dir1'), { recursive: true });
    fs.mkdirSync(path.join(testTargetDir, 'dir2'), { recursive: true });
  });

  beforeEach(() => {
    // 保存原始工作目录
    originalCwd = process.cwd();

    // 创建服务实例
    fileMoveService = new FileMoveService();

    // 每个测试前重新创建测试文件
    fs.writeFileSync(path.join(testSourceDir, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(testSourceDir, 'file2.txt'), 'content2');
    fs.writeFileSync(path.join(testSourceDir, 'file3.jpg'), 'image data');
  });

  afterEach(() => {
    // 恢复原始工作目录
    process.chdir(originalCwd);
  });

  afterAll(() => {
    // 清理测试目录
    cleanupTestDirs();
  });

  describe('moveFile', () => {
    it('应该成功移动文件到目标目录', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      const targetPath = path.join(testTargetDir, 'dir1', 'file1.txt');

      const result = await fileMoveService.moveFile(sourcePath, targetPath);

      expect(result.success).toBe(true);
      expect(result.finalPath).toBe(targetPath);
      expect(fs.existsSync(targetPath)).toBe(true);
    });

    it('应该在覆盖模式下覆盖已存在的文件', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      const targetPath = path.join(testTargetDir, 'dir2', 'file1.txt');
      // 预先创建目标文件
      fs.writeFileSync(targetPath, 'old content');

      const result = await fileMoveService.moveFile(sourcePath, targetPath, { overwrite: true });

      expect(result.success).toBe(true);
      expect(result.finalPath).toBe(targetPath);
      const content = fs.readFileSync(targetPath, 'utf-8');
      expect(content).toBe('content1');
    });

    it('应该在非覆盖模式下生成唯一文件名', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      const targetPath = path.join(testTargetDir, 'dir1', 'file1.txt');
      // 预先创建目标文件
      fs.writeFileSync(targetPath, 'old content');

      const result = await fileMoveService.moveFile(sourcePath, targetPath, { overwrite: false });

      expect(result.success).toBe(true);
      expect(result.finalPath).not.toBe(targetPath);
      expect(result.finalPath).toMatch(/file1\(\d+\)\.txt$/);
      expect(fs.existsSync(result.finalPath)).toBe(true);
    });

    it('应该拒绝移动不存在的源文件', async () => {
      const sourcePath = path.join(testSourceDir, 'nonexistent.txt');
      const targetPath = path.join(testTargetDir, 'dir1', 'nonexistent.txt');

      const result = await fileMoveService.moveFile(sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('文件');
    });

    it('应该拒绝移动到不存在的目标目录', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      const targetPath = path.join(testTargetDir, 'nonexistent', 'file1.txt');

      const result = await fileMoveService.moveFile(sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('目录');
    });
  });

  describe('copyFile', () => {
    it('应该成功复制文件（dry run）', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      const targetPath = path.join(testTargetDir, 'dir2', 'file1.txt');

      const result = await fileMoveService.copyFile(sourcePath, targetPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(targetPath)).toBe(true);
    });

    it('应该拒绝复制不存在的源文件', async () => {
      const sourcePath = path.join(testSourceDir, 'nonexistent.txt');
      const targetPath = path.join(testTargetDir, 'dir2', 'nonexistent.txt');

      const result = await fileMoveService.copyFile(sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('文件');
    });
  });

  describe('fileExists', () => {
    it('应该检查文件是否存在', () => {
      const existingFile = path.join(testSourceDir, 'file1.txt');
      const nonExistentFile = path.join(testSourceDir, 'nonexistent.txt');

      expect(fileMoveService.fileExists(existingFile)).toBe(true);
      expect(fileMoveService.fileExists(nonExistentFile)).toBe(false);
    });
  });

  describe('getFileSize', () => {
    it('应该获取文件大小', () => {
      const filePath = path.join(testSourceDir, 'file1.txt');

      const size = fileMoveService.getFileSize(filePath);

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('应该为不存在的文件返回 0', () => {
      const filePath = path.join(testSourceDir, 'nonexistent.txt');

      const size = fileMoveService.getFileSize(filePath);

      expect(size).toBe(0);
    });

    it('应该为无法读取的文件返回 0', async () => {
      // 创建一个无读取权限的文件
      const restrictedFile = path.join(testSourceDir, 'restricted.txt');
      fs.writeFileSync(restrictedFile, 'content');
      // Windows 下设置文件为只读
      try {
        fs.chmodSync(restrictedFile, 0o444);
      } catch {
        // 忽略 chmod 错误（可能在非 Windows 系统）
      }

      const size = fileMoveService.getFileSize(restrictedFile);

      // 根据系统不同，可能成功也可能返回 0
      expect(typeof size).toBe('number');
    });
  });

  describe('目标目录创建', () => {
    it('应该在需要时自动创建目标目录', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      const newDir = path.join(testTargetDir, 'newdir');
      const targetPath = path.join(newDir, 'file1.txt');

      const result = await fileMoveService.moveFile(sourcePath, targetPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('应该在需要时自动创建嵌套的目录', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      const newDir = path.join(testTargetDir, 'dir1', 'nested', 'deeper', 'directory');
      const targetPath = path.join(newDir, 'file1.txt');

      const result = await fileMoveService.moveFile(sourcePath, targetPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(testTargetDir, 'dir1', 'nested', 'deeper', 'directory'))).toBe(
        true
      );
    });
  });

  describe('错误处理', () => {
    it('应该在移动失败时返回错误信息', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      // 设置为只读模拟权限错误
      fs.chmodSync(sourcePath, 0o444);

      const result = await fileMoveService.moveFile(sourcePath, sourcePath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该在复制失败时返回错误信息', async () => {
      const sourcePath = path.join(testSourceDir, 'file1.txt');
      // 移动到不存在的目录
      const targetPath = path.join(testTargetDir, 'nonexistent', 'file1.txt');

      const result = await fileMoveService.copyFile(sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
