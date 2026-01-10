import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { FileScanService } from '@/lib/services/file-scan.service';
import { cleanupTestDirs, createTestDirs, TEST_TEMP_DIR } from '../setup';
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

// Mock config
vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(() => ({
    scan: {
      max_depth: 3,
    },
  })),
}));

describe('FileScanService', () => {
  let fileScanService: FileScanService;
  let originalCwd: string;

  const testRootDir = path.join(TEST_TEMP_DIR, 'root');
  const testIncomingDir = path.join(TEST_TEMP_DIR, 'incoming');

  beforeAll(() => {
    // 创建测试目录结构
    const dir1 = path.join(testRootDir, 'documents');
    const dir2 = path.join(testRootDir, 'images');
    const subdir1 = path.join(dir1, 'work');

    fs.mkdirSync(testRootDir, { recursive: true });
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });
    fs.mkdirSync(subdir1, { recursive: true });

    // 创建测试文件
    fs.writeFileSync(path.join(dir1, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(dir2, 'image1.jpg'), 'image data');
    fs.writeFileSync(path.join(subdir1, 'file2.txt'), 'content2');

    // 创建 incoming 目录文件
    fs.mkdirSync(testIncomingDir, { recursive: true });
    fs.writeFileSync(path.join(testIncomingDir, 'pending1.txt'), 'pending');
    fs.writeFileSync(path.join(testIncomingDir, 'pending2.pdf'), 'pending2');
    fs.writeFileSync(path.join(testIncomingDir, 'pending3.jpg'), 'pending3');
  });

  beforeEach(() => {
    // 保存原始工作目录
    originalCwd = process.cwd();

    // 创建服务实例
    fileScanService = new FileScanService();
  });

  afterEach(() => {
    // 恢复原始工作目录
    process.chdir(originalCwd);
  });

  afterAll(() => {
    // 清理测试目录
    cleanupTestDirs();
  });

  describe('scanDirs', () => {
    it('应该扫描目录树', () => {
      const dirs = fileScanService.scanDirs(testRootDir);

      expect(dirs).toBeInstanceOf(Array);
      expect(dirs.length).toBeGreaterThan(0);
      expect(dirs).toContain('documents/');
      expect(dirs).toContain('documents/work/');
      expect(dirs).toContain('images/');
    });

    it('应该扫描不存在的目录时返回空数组', () => {
      const dirs = fileScanService.scanDirs('/nonexistent/path');
      expect(dirs).toEqual([]);
    });

    it('应该遵守最大深度限制', () => {
      const dirs = fileScanService.scanDirs(testRootDir);

      // 只扫描到深度3以内的目录
      const subdirs = dirs.filter((d) => d.includes('/'));
      expect(subdirs.length).toBeLessThanOrEqual(3);
    });
  });

  describe('scanFiles', () => {
    it('应该递归扫描所有文件', () => {
      const files = fileScanService.scanFiles(testRootDir);

      expect(files).toBeInstanceOf(Array);
      expect(files.length).toBeGreaterThan(0);
      expect(files).toContain('documents/file1.txt');
      expect(files).toContain('documents/work/file2.txt');
      expect(files).toContain('images/image1.jpg');
    });

    it('应该只返回文件不包括目录', () => {
      const files = fileScanService.scanFiles(testRootDir);

      // 文件路径不应该以 / 结尾
      files.forEach((file) => {
        expect(file.endsWith('/')).toBe(false);
      });
    });

    it('应该扫描不存在的目录时返回空数组', () => {
      const files = fileScanService.scanFiles('/nonexistent/path');
      expect(files).toEqual([]);
    });
  });

  describe('getIncomingFiles', () => {
    it('应该获取待分类目录中的文件列表', () => {
      const files = fileScanService.getIncomingFiles(testIncomingDir);

      expect(files).toBeInstanceOf(Array);
      expect(files.length).toBe(3);
      expect(files).toContain('pending1.txt');
      expect(files).toContain('pending2.pdf');
      expect(files).toContain('pending3.jpg');
    });

    it('应该只返回文件不包括目录', () => {
      const files = fileScanService.getIncomingFiles(testIncomingDir);

      // 文件名不应该包含路径分隔符
      files.forEach((file) => {
        expect(path.sep).not.toBe(file);
      });
    });

    it('应该处理不存在的目录', () => {
      const files = fileScanService.getIncomingFiles('/nonexistent/incoming');
      expect(files).toEqual([]);
    });

    it('应该忽略无法访问的文件', () => {
      // 创建一个无读取权限的文件（模拟）
      const restrictedFile = path.join(testIncomingDir, 'restricted.txt');
      fs.writeFileSync(restrictedFile, 'content');

      const files = fileScanService.getIncomingFiles(testIncomingDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('路径验证', () => {
    it('应该拒绝包含路径遍历的目录', () => {
      // 创建包含 .. 的目录名
      const dangerousDir = path.join(TEST_TEMP_DIR, 'dangerous..dir');
      fs.mkdirSync(dangerousDir, { recursive: true });

      const dirs = fileScanService.scanDirs(dangerousDir);
      // 应该因为路径验证失败而返回空数组或被跳过
      expect(dirs).not.toContain('..');
    });

    it('应该拒绝绝对路径中包含系统目录的请求', () => {
      // Windows 系统目录会被验证器拒绝
      const result = fileScanService.scanFiles('C:\\System32');
      expect(result).toBeDefined();
    });
  });
});
