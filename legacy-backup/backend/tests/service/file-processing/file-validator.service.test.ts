/**
 * FileValidatorService 单元测试
 */

import { test, describe, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FileValidatorService } from '../../../src/service/file-processing/file-validator.service.js';

// Mock logger
vi.mock('../../../src/logger.js', () => ({
  fileInfoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FileValidatorService', () => {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
  let fileValidator: FileValidatorService;

  beforeAll(() => {
    fileValidator = new FileValidatorService();
    // 确保测试目录存在
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
  });

  describe('基本文件验证', () => {
    test('应该正确验证存在的文件', () => {
      const testFile = path.join(fixturesDir, 'validate-test.txt');

      try {
        fs.writeFileSync(testFile, 'test content');

        const result = fileValidator.validateFile(testFile);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确拒绝不存在的文件', () => {
      const nonExistentFile = path.join(fixturesDir, 'does-not-exist.txt');

      const result = fileValidator.validateFile(nonExistentFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('文件不存在');
    });

    test('应该正确拒绝目录', () => {
      const testDir = path.join(fixturesDir, 'test-directory');

      try {
        fs.mkdirSync(testDir, { recursive: true });

        const result = fileValidator.validateFile(testDir);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('不是有效的文件');
      } finally {
        if (fs.existsSync(testDir)) {
          fs.rmdirSync(testDir);
        }
      }
    });

    test('应该正确拒绝空文件', () => {
      const emptyFile = path.join(fixturesDir, 'empty.txt');

      try {
        fs.writeFileSync(emptyFile, '');

        const result = fileValidator.validateFile(emptyFile);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('文件为空');
      } finally {
        if (fs.existsSync(emptyFile)) {
          fs.unlinkSync(emptyFile);
        }
      }
    });

    test('应该正确拒绝过大的文件', () => {
      // 使用较小的文件来测试大小限制逻辑
      const largeFile = path.join(fixturesDir, 'large.txt');
      const largeContent = 'A'.repeat(2000); // 2KB

      try {
        fs.writeFileSync(largeFile, largeContent);

        // 测试大小限制（设置为1KB）
        const sizeResult = fileValidator.validateFileSize(largeFile, 1024); // 1KB限制
        expect(sizeResult.valid).toBe(false);
        expect(sizeResult.error).toContain('文件过大');
      } finally {
        if (fs.existsSync(largeFile)) {
          fs.unlinkSync(largeFile);
        }
      }
    });
  });

  describe('文件大小验证', () => {
    test('应该正确验证文件大小', () => {
      const testFile = path.join(fixturesDir, 'size-test.txt');
      const content = 'A'.repeat(1024); // 1KB

      try {
        fs.writeFileSync(testFile, content);

        // 测试正常大小
        const result1 = fileValidator.validateFileSize(testFile, 2048); // 2KB限制
        expect(result1.valid).toBe(true);
        expect(result1.size).toBe(1024);

        // 测试大小限制
        const result2 = fileValidator.validateFileSize(testFile, 512); // 512B限制
        expect(result2.valid).toBe(false);
        expect(result2.error).toContain('文件过大');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理不存在文件的大小验证', () => {
      const nonExistentFile = path.join(fixturesDir, 'size-nonexistent.txt');

      const result = fileValidator.validateFileSize(nonExistentFile, 1024);
      expect(result.valid).toBe(false);
      // 实际错误信息是系统级的，包含ENOENT
      expect(result.error).toBeDefined();
    });
  });

  describe('文件类型验证', () => {
    test('应该正确验证普通文件', () => {
      const testFile = path.join(fixturesDir, 'regular-file.txt');

      try {
        fs.writeFileSync(testFile, 'test content');

        const result = fileValidator.validateIsRegularFile(testFile);
        expect(result.valid).toBe(true);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确拒绝目录', () => {
      const testDir = path.join(fixturesDir, 'test-dir');

      try {
        fs.mkdirSync(testDir, { recursive: true });

        const result = fileValidator.validateIsRegularFile(testDir);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('不是普通文件');
      } finally {
        if (fs.existsSync(testDir)) {
          fs.rmdirSync(testDir);
        }
      }
    });
  });

  describe('文件权限验证', () => {
    test('应该正确验证可读文件', () => {
      const testFile = path.join(fixturesDir, 'readable.txt');

      try {
        fs.writeFileSync(testFile, 'test content');

        const result = fileValidator.validateReadPermission(testFile);
        expect(result.valid).toBe(true);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确拒绝不存在的文件的读取权限', () => {
      const nonExistentFile = path.join(fixturesDir, 'permission-test.txt');

      const result = fileValidator.validateReadPermission(nonExistentFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('文件不存在');
    });
  });

  describe('目录权限验证', () => {
    test('应该正确验证可写目录', () => {
      const testDir = path.join(fixturesDir, 'writable-dir');

      try {
        fs.mkdirSync(testDir, { recursive: true });

        const result = fileValidator.validateDirectoryWritePermission(testDir);
        expect(result.valid).toBe(true);
      } finally {
        if (fs.existsSync(testDir)) {
          fs.rmdirSync(testDir);
        }
      }
    });

    test('应该正确拒绝不存在的目录', () => {
      const nonExistentDir = path.join(fixturesDir, 'nonexistent-dir');

      const result = fileValidator.validateDirectoryWritePermission(nonExistentDir);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('目录不存在');
    });

    test('应该正确拒绝文件路径', () => {
      const testFile = path.join(fixturesDir, 'not-a-dir.txt');

      try {
        fs.writeFileSync(testFile, 'test');

        const result = fileValidator.validateDirectoryWritePermission(testFile);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('不是目录');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('路径安全验证', () => {
    test('应该正确验证安全路径', () => {
      const safePaths = [
        'subfolder/file.txt',
        'deep/nested/path/file.txt',
        'file.txt',
        './relative/path.txt',
      ];

      const baseDir = '/app/allowed';

      safePaths.forEach((testPath) => {
        const result = fileValidator.validateSafePath(testPath, baseDir);
        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBeDefined();
      });
    });

    test('应该正确拒绝不安全路径', () => {
      const unsafePaths = [
        '../../../etc/passwd',
        '..\\windows\\system32\\config\\sam',
        '~/.ssh/id_rsa',
        '/etc/passwd',
      ];

      const baseDir = '/app/allowed';

      unsafePaths.forEach((testPath) => {
        const result = fileValidator.validateSafePath(testPath, baseDir);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('应该正确处理路径遍历攻击', () => {
      const baseDir = '/app/allowed';
      const attackPaths = [
        '../../../etc/passwd',
        'file/../../../etc/passwd',
        'normal/../../../etc/passwd',
        '../allowed/../etc/passwd',
      ];

      attackPaths.forEach((testPath) => {
        const result = fileValidator.validateSafePath(testPath, baseDir);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('综合验证', () => {
    test('应该正确验证可处理的文件', () => {
      const testFile = path.join(fixturesDir, 'process-test.txt');

      try {
        fs.writeFileSync(testFile, 'This file can be processed');

        const result = fileValidator.validateFileForProcessing(testFile);
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确拒绝不可处理的文件', () => {
      const nonExistentFile = path.join(fixturesDir, 'cannot-process.txt');

      const result = fileValidator.validateFileForProcessing(nonExistentFile);
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });

    test('应该正确处理自定义大小限制', () => {
      const testFile = path.join(fixturesDir, 'custom-size-test.txt');
      const content = 'A'.repeat(2048); // 2KB

      try {
        fs.writeFileSync(testFile, content);

        // 使用自定义大小限制 (1KB)
        const result = fileValidator.validateFileForProcessing(testFile, 1024);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('文件过大');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  afterAll(() => {
    // 清理可能遗留的测试文件和目录
    const testFiles = [
      'validate-test.txt',
      'empty.txt',
      'large.txt',
      'size-test.txt',
      'size-nonexistent.txt',
      'regular-file.txt',
      'readable.txt',
      'permission-test.txt',
      'not-a-dir.txt',
      'process-test.txt',
      'cannot-process.txt',
      'custom-size-test.txt',
    ];

    const testDirs = ['test-directory', 'test-dir', 'writable-dir', 'nonexistent-dir'];

    testFiles.forEach((filename) => {
      const filepath = path.join(fixturesDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });

    testDirs.forEach((dirname) => {
      const dirpath = path.join(fixturesDir, dirname);
      if (fs.existsSync(dirpath)) {
        fs.rmdirSync(dirpath);
      }
    });

    // 清理可能遗留的临时文件
    try {
      const tempFiles = fs.readdirSync(fixturesDir);
      tempFiles.forEach((file) => {
        if (file.includes('test') || file.includes('.gitkeep') === false) {
          const filePath = path.join(fixturesDir, file);
          try {
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
            }
          } catch {
            // 忽略清理错误
          }
        }
      });
    } catch {
      // 忽略读取目录错误
    }
  });
});
