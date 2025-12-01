/**
 * FileInfoService 集成测试
 * 验证协调器是否正确委托给子服务
 */

import { test, describe, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FileInfoService } from '../../src/service/file-info.service.js';

// Mock exiftool-vendored
vi.mock('exiftool-vendored', () => ({
  exiftool: {
    read: vi.fn(() =>
      Promise.resolve({
        Title: 'Integration Test Title',
        Author: 'Test Author',
        Description: 'Integration test description',
      })
    ),
    end: vi.fn(() => Promise.resolve()),
  },
}));

// Mock logger
vi.mock('../../src/logger.js', () => ({
  fileInfoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FileInfoService 集成测试', () => {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
  let fileInfoService: FileInfoService;

  beforeAll(() => {
    fileInfoService = new FileInfoService();
    // 确保测试目录存在
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
  });

  describe('向后兼容性测试', () => {
    test('应该保持所有原有接口正常工作', () => {
      const testFile = path.join(fixturesDir, 'compatibility-test.txt');
      const content = 'This is a test for backward compatibility';

      try {
        fs.writeFileSync(testFile, content);

        // 测试所有原有接口
        expect(fileInfoService.checkIsTextFile(testFile)).toBe(true);

        const preview = fileInfoService.getTextFilePreview(testFile, 2, 50);
        expect(Array.isArray(preview)).toBe(true);
        expect(preview.length).toBeGreaterThan(0);

        const fullContent = fileInfoService.getTextFileContent(testFile);
        expect(fullContent).toBe(content);

        const segment = fileInfoService.getFileSegment(testFile, 0, 10);
        expect(segment).toBe('This is a ');

        const basicInfo = fileInfoService.getFileBasicInfo(testFile);
        expect(basicInfo.name).toBe('compatibility-test.txt');
        expect(basicInfo.ext).toBe('.txt');
        expect(basicInfo.isText).toBe(true);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理流式读取接口', () => {
      const testFile = path.join(fixturesDir, 'stream-compatibility.txt');
      const content = 'This is a compatibility test for streaming interface';

      try {
        fs.writeFileSync(testFile, content);

        let collectedContent = '';
        const result = fileInfoService.readFileStream(
          testFile,
          (chunk, isLast) => {
            collectedContent += chunk;
            return true;
          },
          { chunkSize: 10 }
        );

        expect(result.totalBytesRead).toBe(content.length);
        expect(result.stopped).toBe(false);
        expect(collectedContent).toBe(content);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('协调器委托测试', () => {
    test('应该正确委托文本文件检测', () => {
      const textFile = path.join(fixturesDir, 'delegate-text.txt');
      const binaryFile = path.join(fixturesDir, 'delegate-binary.bin');

      try {
        fs.writeFileSync(textFile, 'This is a text file');
        fs.writeFileSync(binaryFile, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

        // 通过协调器调用，实际应该由FileReaderService处理
        expect(fileInfoService.checkIsTextFile(textFile)).toBe(true);
        expect(fileInfoService.checkIsTextFile(binaryFile)).toBe(false);
      } finally {
        [textFile, binaryFile].forEach((file) => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
      }
    });

    test('应该正确委托文件验证', () => {
      const testFile = path.join(fixturesDir, 'delegate-validate.txt');
      const nonExistentFile = path.join(fixturesDir, 'delegate-nonexistent.txt');

      try {
        fs.writeFileSync(testFile, 'test content');

        // 通过协调器调用新的验证接口
        const validResult = fileInfoService.validateFile(testFile);
        expect(validResult.valid).toBe(true);

        const invalidResult = fileInfoService.validateFile(nonExistentFile);
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.error).toBe('文件不存在');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确委托元数据获取', async () => {
      const testFile = path.join(fixturesDir, 'delegate-metadata.txt');
      const content = 'This is a test file for metadata delegation';

      try {
        fs.writeFileSync(testFile, content);

        const metadata = await fileInfoService.getSpecificMetadata(testFile);

        expect(metadata.basic).toBeDefined();
        expect(metadata.basic.name).toBe('delegate-metadata.txt');
        expect(metadata.basic.isText).toBe(true);
        expect(metadata.basic.size).toBe(content.length);

        // custom metadata应该是JSON解析的结果（如果是JSON文件）
        expect(typeof metadata.custom).toBe('object');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('文件描述生成集成测试', () => {
    test('应该正确生成文本文件描述', async () => {
      const testFile = path.join(fixturesDir, 'integration-text.txt');
      const content =
        'This is a meaningful content for integration testing. It should be properly extracted and formatted.';

      try {
        fs.writeFileSync(testFile, content);

        const description = await fileInfoService.getFileDescription(testFile);

        // 验证格式
        expect(description).toMatch(/^元数据: \n摘要: /);

        const lines = description.split('\n');
        expect(lines).toHaveLength(2);

        // 验证元数据部分
        expect(lines[0]).toBe('元数据: ');

        // 验证摘要部分
        expect(lines[1]).toMatch(/^摘要: /);
        const summary = lines[1].replace('摘要: ', '');
        expect(summary).toContain('This is a meaningful content');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确生成JSON文件描述', async () => {
      const testFile = path.join(fixturesDir, 'integration-json.json');
      const jsonData = {
        name: 'Integration Test App',
        title: 'Integration Test Title',
        description: 'A comprehensive integration test application',
        version: '1.0.0',
      };

      try {
        fs.writeFileSync(testFile, JSON.stringify(jsonData, null, 2));

        const description = await fileInfoService.getFileDescription(testFile);

        // 验证格式
        expect(description).toMatch(/^元数据: \n摘要: /);

        const summary = description.split('\n')[1].replace('摘要: ', '');
        // JSON文件应该提取name字段
        expect(summary).toBe('Integration Test App');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理无效文件', async () => {
      const nonExistentFile = path.join(fixturesDir, 'integration-nonexistent.txt');

      const description = await fileInfoService.getFileDescription(nonExistentFile);
      expect(description).toBe('');
    });

    test('应该正确处理空文件', async () => {
      const emptyFile = path.join(fixturesDir, 'integration-empty.txt');

      try {
        fs.writeFileSync(emptyFile, '');

        const description = await fileInfoService.getFileDescription(emptyFile);
        expect(description).toBe('');
      } finally {
        if (fs.existsSync(emptyFile)) {
          fs.unlinkSync(emptyFile);
        }
      }
    });
  });

  describe('错误处理集成测试', () => {
    test('应该正确处理文本文件的二进制检测错误', () => {
      const testFile = path.join(fixturesDir, 'error-binary.bin');

      try {
        // 创建二进制文件（非文本扩展名）
        fs.writeFileSync(testFile, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

        expect(() => {
          fileInfoService.getTextFileContent(testFile);
        }).toThrow();

        expect(() => {
          fileInfoService.getTextFilePreview(testFile);
        }).toThrow();
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理不存在文件的各个接口', () => {
      const nonExistentFile = path.join(fixturesDir, 'error-nonexistent.txt');

      expect(() => {
        fileInfoService.getFileBasicInfo(nonExistentFile);
      }).toThrow();

      expect(() => {
        fileInfoService.getTextFileContent(nonExistentFile);
      }).toThrow();
    });

    test('应该正确处理文件大小限制', () => {
      const testFile = path.join(fixturesDir, 'error-size.txt');
      const content = 'A'.repeat(2000); // 2KB

      try {
        fs.writeFileSync(testFile, content);

        expect(() => {
          fileInfoService.getTextFileContent(testFile, 1024); // 1KB限制
        }).toThrow('文件过大');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('清理方法集成测试', () => {
    test('应该正确调用清理方法', async () => {
      expect(async () => {
        await fileInfoService.cleanupExiftool();
      }).not.toThrow();

      expect(() => {
        fileInfoService.cleanupExiftoolSync();
      }).not.toThrow();
    });
  });

  describe('多文件类型集成测试', () => {
    test('应该正确处理各种已知文件类型', async () => {
      const testCases = [
        { ext: '.md', content: '# Markdown Document\nThis is a markdown file' },
        { ext: '.js', content: 'console.log("Hello World");' },
        { ext: '.py', content: 'print("Hello World")' },
        { ext: '.html', content: '<html><body>Hello</body></html>' },
        { ext: '.css', content: 'body { color: red; }' },
        { ext: '.xml', content: '<?xml version="1.0"?><root>data</root>' },
        { ext: '.yaml', content: 'key: value\nlist:\n  - item1\n  - item2' },
        { ext: '.log', content: '2023-01-01 12:00:00 INFO Application started' },
      ];

      for (const testCase of testCases) {
        const testFile = path.join(fixturesDir, `integration-type${testCase.ext}`);

        try {
          fs.writeFileSync(testFile, testCase.content);

          // 测试基本信息
          const basicInfo = fileInfoService.getFileBasicInfo(testFile);
          expect(basicInfo.ext).toBe(testCase.ext);
          expect(basicInfo.isText).toBe(true);

          // 测试文本检测
          expect(fileInfoService.checkIsTextFile(testFile)).toBe(true);

          // 测试描述生成
          const description = await fileInfoService.getFileDescription(testFile);
          expect(description).toMatch(/^元数据: \n摘要: /);
        } finally {
          if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
          }
        }
      }
    });
  });

  describe('性能和并发测试', () => {
    test('应该能够并发处理多个文件', async () => {
      const testFiles = [];
      const fileCount = 5;

      // 创建多个测试文件
      for (let i = 0; i < fileCount; i++) {
        const testFile = path.join(fixturesDir, `concurrent-test-${i}.txt`);
        const content = `This is concurrent test file ${i} with some content`;

        fs.writeFileSync(testFile, content);
        testFiles.push(testFile);
      }

      try {
        // 并发获取文件描述
        const descriptions = await Promise.all(
          testFiles.map((file) => fileInfoService.getFileDescription(file))
        );

        // 验证所有文件都处理成功
        expect(descriptions).toHaveLength(fileCount);
        descriptions.forEach((description) => {
          expect(description).toMatch(/^元数据: \n摘要: /);
        });
      } finally {
        // 清理测试文件
        testFiles.forEach((file) => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
      }
    });
  });

  afterAll(() => {
    // 清理可能遗留的测试文件
    const testFiles = [
      'compatibility-test.txt',
      'stream-compatibility.txt',
      'delegate-text.txt',
      'delegate-binary.bin',
      'delegate-validate.txt',
      'delegate-metadata.txt',
      'integration-text.txt',
      'integration-json.json',
      'integration-nonexistent.txt',
      'integration-empty.txt',
      'error-binary.txt',
      'error-nonexistent.txt',
      'error-size.txt',
    ];

    testFiles.forEach((filename) => {
      const filepath = path.join(fixturesDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });

    // 清理多文件类型测试文件
    const typeExtensions = ['.md', '.js', '.py', '.html', '.css', '.xml', '.yaml', '.log'];
    typeExtensions.forEach((ext) => {
      const filepath = path.join(fixturesDir, `integration-type${ext}`);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });

    // 清理并发测试文件
    for (let i = 0; i < 5; i++) {
      const filepath = path.join(fixturesDir, `concurrent-test-${i}.txt`);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
  });
});
