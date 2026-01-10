import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FileReaderService } from '@/lib/services/file-processing/file-reader.service';
import { FileMetadataService } from '@/lib/services/file-processing/file-metadata.service';

describe('FileMetadataService', () => {
  let fileReader: FileReaderService;
  let service: FileMetadataService;
  let testDir: string;

  beforeEach(() => {
    fileReader = new FileReaderService();
    service = new FileMetadataService(fileReader);
    testDir = path.join(process.cwd(), 'tests', 'fixtures', 'file-metadata-test');

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  describe('getFileBasicInfo', () => {
    it('应该获取文件基本信息', () => {
      const testFile = path.join(testDir, 'test.txt');
      fs.writeFileSync(testFile, 'Test content');

      const info = service.getFileBasicInfo(testFile);

      expect(info.name).toBe('test.txt');
      expect(info.ext).toBe('.txt');
      expect(info.size).toBeGreaterThan(0);
      expect(info.isText).toBe(true);
      expect(info.modified).toBeInstanceOf(Date);
      expect(info.created).toBeInstanceOf(Date);
    });
  });

  describe('generateTextFileDescription', () => {
    it('应该为普通文本文件生成描述', () => {
      const testFile = path.join(testDir, 'desc.txt');
      fs.writeFileSync(testFile, 'This is a description\nWith multiple lines\nOf content');

      const description = service.generateTextFileDescription(testFile);

      expect(description).toContain('This is a description');
    });

    it('应该为JSON文件提取特定字段', () => {
      const testFile = path.join(testDir, 'data.json');
      fs.writeFileSync(testFile, JSON.stringify({ name: 'Test Name', version: '1.0.0' }));

      const description = service.generateTextFileDescription(testFile);

      expect(description).toBe('Test Name');
    });

    it('应该处理空文件', () => {
      const testFile = path.join(testDir, 'empty.txt');
      fs.writeFileSync(testFile, '');

      const description = service.generateTextFileDescription(testFile);

      expect(description).toBe('');
    });
  });

  describe('formatFilePrompt', () => {
    it('应该格式化文件提示信息', () => {
      const result = service.formatFilePrompt('tag1, tag2', 'summary text');

      expect(result).toContain('元数据');
      expect(result).toContain('摘要');
    });

    it('应该处理空输入', () => {
      const result = service.formatFilePrompt('', '');

      expect(result).toBe('');
    });
  });
});
