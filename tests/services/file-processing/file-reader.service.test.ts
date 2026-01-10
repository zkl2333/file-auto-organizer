import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FileReaderService } from '@/lib/services/file-processing/file-reader.service';

describe('FileReaderService', () => {
  let service: FileReaderService;
  let testDir: string;

  beforeEach(() => {
    service = new FileReaderService();
    testDir = path.join(process.cwd(), 'tests', 'fixtures', 'file-reader-test');

    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testDir, file));
      }
    }
  });

  describe('isTextFile', () => {
    it('应该通过扩展名识别文本文件', () => {
      const textFile = path.join(testDir, 'test.txt');
      fs.writeFileSync(textFile, 'Hello World');

      expect(service.checkIsTextFile(textFile)).toBe(true);
    });

    it('应该通过内容识别二进制文件（PNG签名）', () => {
      const binaryFile = path.join(testDir, 'test.unknown');
      // PNG 文件签名
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      fs.writeFileSync(binaryFile, pngSignature);

      expect(service.checkIsTextFile(binaryFile)).toBe(false);
    });

    it('应该通过null字节占比识别二进制文件', () => {
      const binaryFile = path.join(testDir, 'test.bin');
      // 创建包含大量null字节的文件
      const buffer = Buffer.alloc(1024);
      buffer.fill(0);
      fs.writeFileSync(binaryFile, buffer);

      expect(service.checkIsTextFile(binaryFile)).toBe(false);
    });

    it('应该识别常见的文本文件扩展名', () => {
      const extensions = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html'];

      for (const ext of extensions) {
        const file = path.join(testDir, `test${ext}`);
        fs.writeFileSync(file, 'content');
        expect(service.checkIsTextFile(file)).toBe(true);
      }
    });
  });

  describe('readTextFileLines', () => {
    it('应该读取文本文件的前几行', () => {
      const textFile = path.join(testDir, 'multiline.txt');
      fs.writeFileSync(textFile, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

      const lines = service.readTextFileLines(textFile, 3, 100);

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');
    });

    it('应该限制字符总数', () => {
      const textFile = path.join(testDir, 'long.txt');
      const longContent = 'A'.repeat(1000);
      fs.writeFileSync(textFile, longContent);

      const lines = service.readTextFileLines(textFile, 10, 50);
      const totalChars = lines.join('').length;

      expect(totalChars).toBeLessThanOrEqual(50 + 10); // +10 for '...'
    });

    it('应该跳过空行', () => {
      const textFile = path.join(testDir, 'empty-lines.txt');
      fs.writeFileSync(textFile, 'Line 1\n\n\nLine 2\n\nLine 3');

      const lines = service.readTextFileLines(textFile, 5, 100);

      expect(lines).toHaveLength(3);
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('应该处理不同的换行符', () => {
      const textFile = path.join(testDir, 'crlf.txt');
      fs.writeFileSync(textFile, 'Line 1\r\nLine 2\rLine 3\nLine 4');

      const lines = service.readTextFileLines(textFile, 10, 100);

      expect(lines.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getTextFileContent', () => {
    it('应该读取文本文件的完整内容', () => {
      const textFile = path.join(testDir, 'full.txt');
      const content = 'Full content\nWith multiple\nLines';
      fs.writeFileSync(textFile, content);

      const result = service.getTextFileContent(textFile);

      expect(result).toBe(content);
    });

    it('应该拒绝过大的文件', () => {
      const textFile = path.join(testDir, 'large.txt');
      fs.writeFileSync(textFile, 'content');

      expect(() => {
        service.getTextFileContent(textFile, 5); // 限制为5字节
      }).toThrow('文件过大');
    });

    it('应该拒绝非文本文件', () => {
      const binaryFile = path.join(testDir, 'binary.bin');
      const buffer = Buffer.alloc(100);
      buffer.fill(0);
      fs.writeFileSync(binaryFile, buffer);

      expect(() => {
        service.getTextFileContent(binaryFile);
      }).toThrow('不是文本文件');
    });
  });

  describe('getTextFilePreview', () => {
    it('应该获取文本文件预览', () => {
      const textFile = path.join(testDir, 'preview.txt');
      fs.writeFileSync(textFile, 'Preview\nLine 1\nLine 2\nLine 3');

      const preview = service.getTextFilePreview(textFile, 2, 50);

      expect(preview).toHaveLength(2);
      expect(preview[0]).toBe('Preview');
    });

    it('应该拒绝非文本文件', () => {
      const binaryFile = path.join(testDir, 'binary.bin');
      const buffer = Buffer.alloc(100);
      buffer.fill(0);
      fs.writeFileSync(binaryFile, buffer);

      expect(() => {
        service.getTextFilePreview(binaryFile);
      }).toThrow('不是文本文件');
    });
  });

  describe('getFileSegment', () => {
    it('应该读取文件的指定片段', () => {
      const textFile = path.join(testDir, 'segment.txt');
      fs.writeFileSync(textFile, '0123456789ABCDEFGHIJ');

      const segment = service.getFileSegment(textFile, 5, 10);

      expect(segment).toBe('56789ABCDE');
    });

    it('应该处理超出范围的读取', () => {
      const textFile = path.join(testDir, 'short.txt');
      fs.writeFileSync(textFile, 'Short');

      const segment = service.getFileSegment(textFile, 100, 50);

      expect(segment).toBe('');
    });

    it('应该拒绝非文本文件', () => {
      const binaryFile = path.join(testDir, 'binary.bin');
      const buffer = Buffer.alloc(100);
      buffer.fill(0);
      fs.writeFileSync(binaryFile, buffer);

      expect(() => {
        service.getFileSegment(binaryFile);
      }).toThrow('不是文本文件');
    });
  });

  describe('readFileStream', () => {
    it('应该流式处理文件内容', () => {
      const textFile = path.join(testDir, 'stream.txt');
      fs.writeFileSync(textFile, 'Chunk 1\nChunk 2\nChunk 3');

      const chunks: string[] = [];
      const result = service.readFileStream(
        textFile,
        (chunk, isLast) => {
          chunks.push(chunk);
          return true; // 继续读取
        },
        { chunkSize: 10 }
      );

      expect(result.stopped).toBe(false);
      expect(result.totalBytesRead).toBeGreaterThan(0);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('应该支持提前停止读取', () => {
      const textFile = path.join(testDir, 'stop.txt');
      fs.writeFileSync(textFile, 'A'.repeat(10000));

      let chunkCount = 0;
      const result = service.readFileStream(
        textFile,
        (chunk, isLast) => {
          chunkCount++;
          return chunkCount < 3; // 读取3个块后停止
        },
        { chunkSize: 100 }
      );

      // 验证提前停止（chunkCount应该等于3，因为第3个块返回false后停止）
      expect(chunkCount).toBe(3);
      expect(result.totalBytesRead).toBeLessThan(10000); // 应该没有读取全部内容
    });

    it('应该拒绝非文本文件', () => {
      const binaryFile = path.join(testDir, 'binary.bin');
      const buffer = Buffer.alloc(100);
      buffer.fill(0);
      fs.writeFileSync(binaryFile, buffer);

      expect(() => {
        service.readFileStream(binaryFile, () => true);
      }).toThrow('不是文本文件');
    });
  });

  describe('getPerformanceMetrics', () => {
    it('应该返回性能指标', () => {
      const textFile = path.join(testDir, 'metrics.txt');
      fs.writeFileSync(textFile, 'Test content');

      // 执行一些操作
      service.checkIsTextFile(textFile);
      service.readTextFileLines(textFile, 3, 100);

      const metrics = service.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });
  });
});
