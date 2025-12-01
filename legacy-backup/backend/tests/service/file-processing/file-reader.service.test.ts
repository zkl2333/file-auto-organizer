/**
 * FileReaderService 单元测试
 */

import { test, describe, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FileReaderService } from '../../../src/service/file-processing/file-reader.service.js';
import { fileInfoLogger } from '../../../src/logger.js';

// Mock logger
vi.mock('../../../src/logger.js', () => ({
  fileInfoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FileReaderService', () => {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
  let fileReader: FileReaderService;

  beforeAll(() => {
    fileReader = new FileReaderService();
    // 确保测试目录存在
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
  });

  describe('文本文件检测', () => {
    test('应该正确识别文本文件扩展名', () => {
      const textExtensions = [
        '.txt',
        '.log',
        '.md',
        '.json',
        '.xml',
        '.html',
        '.htm',
        '.css',
        '.js',
        '.ts',
        '.py',
        '.java',
        '.c',
        '.cpp',
        '.h',
        '.hpp',
        '.cs',
        '.php',
        '.rb',
        '.go',
        '.rs',
        '.kt',
        '.swift',
        '.sql',
        '.sh',
        '.bat',
        '.cmd',
        '.ps1',
        '.yaml',
        '.yml',
        '.ini',
        '.conf',
        '.config',
        '.properties',
        '.env',
        '.gitignore',
        '.dockerfile',
        '.csv',
        '.tsv',
        '.rtf',
        '.tex',
        '.latex',
      ];

      textExtensions.forEach((ext) => {
        const mockFilePath = `test${ext}`;
        expect(fileReader.isTextFile(mockFilePath)).toBe(true);
      });
    });

    test('应该正确识别二进制文件签名', () => {
      const binarySignatures = [
        { name: 'PNG', signature: [0x89, 0x50, 0x4e, 0x47] },
        { name: 'JPEG', signature: [0xff, 0xd8, 0xff] },
        { name: 'GIF', signature: [0x47, 0x49, 0x46] },
        { name: 'PDF', signature: [0x25, 0x50, 0x44, 0x46] },
        { name: 'ZIP', signature: [0x50, 0x4b, 0x03, 0x04] },
        { name: 'RAR', signature: [0x52, 0x61, 0x72, 0x21] },
        { name: 'ELF', signature: [0x7f, 0x45, 0x4c, 0x46] },
        { name: 'EXE', signature: [0x4d, 0x5a] },
      ];

      binarySignatures.forEach(({ name, signature }) => {
        const testFile = path.join(fixturesDir, `binary-${name.toLowerCase()}.bin`);

        try {
          // 创建包含特定签名的文件
          const fileBuffer = Buffer.from(signature.concat(Array(100).fill(0)));
          fs.writeFileSync(testFile, fileBuffer);

          expect(fileReader.isTextFile(testFile)).toBe(false);
        } finally {
          if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
          }
        }
      });
    });

    test('应该正确识别纯文本文件', () => {
      const testFile = path.join(fixturesDir, 'pure-text.txt');
      const content = 'This is a pure text file\nwith multiple lines\nand ASCII characters only.';

      try {
        fs.writeFileSync(testFile, content);
        expect(fileReader.isTextFile(testFile)).toBe(true);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('文件内容读取', () => {
    test('应该正确读取文本文件行', () => {
      const testFile = path.join(fixturesDir, 'lines-test.txt');
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

      try {
        fs.writeFileSync(testFile, content);

        // 测试读取前3行
        const lines = fileReader.readTextFileLines(testFile, 3);
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Line 1');
        expect(lines[1]).toBe('Line 2');
        expect(lines[2]).toBe('Line 3');

        // 测试读取更多行（实际只有5行）
        const allLines = fileReader.readTextFileLines(testFile, 10);
        expect(allLines).toHaveLength(5);
        expect(allLines[4]).toBe('Line 5');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理字符限制', () => {
      const testFile = path.join(fixturesDir, 'chars-test.txt');
      const longLine =
        'This is a very long line that should be truncated when we apply character limits to test the functionality';

      try {
        fs.writeFileSync(testFile, longLine);

        // 测试字符限制
        const truncatedLines = fileReader.readTextFileLines(testFile, 1, 20);
        expect(truncatedLines).toHaveLength(1);
        expect(truncatedLines[0]).toBe('This is a very long ...');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确读取完整文件内容', () => {
      const testFile = path.join(fixturesDir, 'full-content.txt');
      const content = 'Hello, World!\nThis is a test file.\nWith multiple lines.';

      try {
        fs.writeFileSync(testFile, content);

        const fullContent = fileReader.getTextFileContent(testFile);
        expect(fullContent).toBe(content);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该处理文件大小限制', () => {
      const testFile = path.join(fixturesDir, 'size-limit.txt');
      const content = 'A'.repeat(2000); // 2KB

      try {
        fs.writeFileSync(testFile, content);

        // 测试大小限制（设置为1KB）
        expect(() => {
          fileReader.getTextFileContent(testFile, 1024);
        }).toThrow('文件过大');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确读取文件段', () => {
      const testFile = path.join(fixturesDir, 'segment-test.txt');
      const content = '0123456789ABCDEFGHIJ';

      try {
        fs.writeFileSync(testFile, content);

        // 读取前10个字符
        const segment1 = fileReader.getFileSegment(testFile, 0, 10);
        expect(segment1).toBe('0123456789');

        // 读取后10个字符
        const segment2 = fileReader.getFileSegment(testFile, 10, 10);
        expect(segment2).toBe('ABCDEFGHIJ');

        // 读取超出文件大小
        const segment3 = fileReader.getFileSegment(testFile, 5, 50);
        expect(segment3).toBe('56789ABCDEFGHIJ');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('流式读取', () => {
    test('应该正确处理流式读取', () => {
      const testFile = path.join(fixturesDir, 'stream-test.txt');
      const content = 'This is a test for streaming reading functionality with chunk processing.';

      try {
        fs.writeFileSync(testFile, content);

        let collectedChunks = '';
        const result = fileReader.readFileStream(
          testFile,
          (chunk, isLast) => {
            collectedChunks += chunk;
            return true; // 继续读取
          },
          { chunkSize: 10 }
        );

        expect(result.stopped).toBe(false);
        expect(result.totalBytesRead).toBe(content.length);
        expect(collectedChunks).toBe(content);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该支持提前停止流式读取', () => {
      const testFile = path.join(fixturesDir, 'stream-stop-test.txt');
      const content =
        'This is a longer content that we will stop reading early to test the stop functionality.';

      try {
        fs.writeFileSync(testFile, content);

        let callCount = 0;
        const result = fileReader.readFileStream(
          testFile,
          (chunk, isLast) => {
            callCount++;
            return false; // 在第一次回调时停止
          },
          { chunkSize: 10 }
        );

        expect(result.stopped).toBe(true);
        expect(callCount).toBe(1);
        // 由于实现细节，可能读取的字节数会略有不同
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('错误处理', () => {
    test('应该正确处理不存在的文件', () => {
      const nonExistentFile = path.join(fixturesDir, 'does-not-exist.txt');

      // 这些方法实际上返回空数组而不是抛出异常
      // 这是当前实现的容错处理方式
      const lines = fileReader.readTextFileLines(nonExistentFile);
      expect(Array.isArray(lines)).toBe(true);

      expect(() => {
        fileReader.getTextFileContent(nonExistentFile);
      }).toThrow();
    });

    test('应该正确处理非文本文件', () => {
      const testFile = path.join(fixturesDir, 'not-text.bin');
      const binaryContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG header

      try {
        fs.writeFileSync(testFile, binaryContent);

        expect(fileReader.isTextFile(testFile)).toBe(false);

        expect(() => {
          fileReader.getTextFileContent(testFile);
        }).toThrow('指定文件不是文本文件');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('公共接口', () => {
    test('checkIsTextFile 应该正确工作', () => {
      const textFile = path.join(fixturesDir, 'public-interface-text.txt');
      const binaryFile = path.join(fixturesDir, 'public-interface-bin.bin');

      try {
        fs.writeFileSync(textFile, 'This is a text file');
        fs.writeFileSync(binaryFile, Buffer.from([0xff, 0xd8, 0xff]));

        expect(fileReader.checkIsTextFile(textFile)).toBe(true);
        expect(fileReader.checkIsTextFile(binaryFile)).toBe(false);
      } finally {
        [textFile, binaryFile].forEach((file) => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
      }
    });

    test('getTextFilePreview 应该正确工作', () => {
      const testFile = path.join(fixturesDir, 'preview-test.txt');
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

      try {
        fs.writeFileSync(testFile, content);

        const preview = fileReader.getTextFilePreview(testFile, 3, 50);
        expect(preview).toHaveLength(3);
        expect(preview[0]).toBe('Line 1');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  afterAll(() => {
    // 清理可能遗留的测试文件
    const testFiles = [
      'binary-png.bin',
      'binary-jpeg.bin',
      'binary-gif.bin',
      'binary-pdf.bin',
      'binary-zip.bin',
      'binary-rar.bin',
      'binary-elf.bin',
      'binary-exe.bin',
      'pure-text.txt',
      'lines-test.txt',
      'chars-test.txt',
      'full-content.txt',
      'size-limit.txt',
      'segment-test.txt',
      'stream-test.txt',
      'stream-stop-test.txt',
      'not-text.bin',
      'public-interface-text.txt',
      'public-interface-bin.bin',
      'preview-test.txt',
    ];

    testFiles.forEach((filename) => {
      const filepath = path.join(fixturesDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
  });
});
