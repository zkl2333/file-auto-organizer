import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FileValidatorService } from '@/lib/services/file-processing/file-validator.service';

describe('FileValidatorService', () => {
  let service: FileValidatorService;
  let testDir: string;

  beforeEach(() => {
    service = new FileValidatorService();
    testDir = path.join(process.cwd(), 'tests', 'fixtures', 'file-validator-test');

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        const filePath = path.join(testDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    }
  });

  describe('validateFile', () => {
    it('应该验证正常文件', () => {
      const testFile = path.join(testDir, 'valid.txt');
      fs.writeFileSync(testFile, 'content');

      const result = service.validateFile(testFile);

      expect(result.valid).toBe(true);
      expect(result.realPath).toBeDefined();
    });

    it('应该拒绝不存在的文件', () => {
      const result = service.validateFile('/nonexistent/file.txt');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不存在');
    });

    it('应该拒绝空文件', () => {
      const testFile = path.join(testDir, 'empty.txt');
      fs.writeFileSync(testFile, '');

      const result = service.validateFile(testFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('为空');
    });
  });

  describe('validateFileSize', () => {
    it('应该验证文件大小', () => {
      const testFile = path.join(testDir, 'size.txt');
      fs.writeFileSync(testFile, 'a'.repeat(100));

      const result = service.validateFileSize(testFile, 1024);

      expect(result.valid).toBe(true);
      expect(result.size).toBe(100);
    });

    it('应该拒绝过大的文件', () => {
      const testFile = path.join(testDir, 'large.txt');
      fs.writeFileSync(testFile, 'a'.repeat(1000));

      const result = service.validateFileSize(testFile, 500);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('过大');
    });
  });

  describe('validateFileName', () => {
    it('应该验证正常文件名', () => {
      const result = service.validateFileName('normal-file.txt');

      expect(result.valid).toBe(true);
    });

    it('应该拒绝非法字符', () => {
      const result = service.validateFileName('file<name>.txt');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('非法字符');
    });

    it('应该拒绝Windows保留名称', () => {
      const result = service.validateFileName('CON.txt');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('保留名称');
    });

    it('应该拒绝过长的文件名', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = service.validateFileName(longName);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('长度无效');
    });
  });

  describe('validateReadPermission', () => {
    it('应该验证可读文件', () => {
      const testFile = path.join(testDir, 'readable.txt');
      fs.writeFileSync(testFile, 'content');

      const result = service.validateReadPermission(testFile);

      expect(result.valid).toBe(true);
    });

    it('应该拒绝不存在的文件', () => {
      const result = service.validateReadPermission('/nonexistent/file.txt');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不存在');
    });
  });

  describe('validateFileForProcessing', () => {
    it('应该验证可处理的文件', () => {
      const testFile = path.join(testDir, 'processable.txt');
      fs.writeFileSync(testFile, 'content');

      const result = service.validateFileForProcessing(testFile);

      expect(result.valid).toBe(true);
    });

    it('应该拒绝空文件', () => {
      const testFile = path.join(testDir, 'empty-process.txt');
      fs.writeFileSync(testFile, '');

      const result = service.validateFileForProcessing(testFile);

      expect(result.valid).toBe(false);
    });
  });
});
