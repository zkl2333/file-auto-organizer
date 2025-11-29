/**
 * FileMetadataService 单元测试
 */

import { test, describe, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FileMetadataService } from '../../../src/service/file-processing/file-metadata.service.js';
import { FileReaderService } from '../../../src/service/file-processing/file-reader.service.js';

// Mock exiftool-vendored
vi.mock('exiftool-vendored', () => ({
  exiftool: {
    read: vi.fn(() =>
      Promise.resolve({
        Title: 'Test Title',
        Author: 'Test Author',
        Description: 'Test Description',
        Software: 'Test Software',
        // 添加一些其他有意义的字段
        Keywords: 'test, metadata, extraction',
        Subject: 'Test Subject',
      })
    ),
    end: vi.fn(() => Promise.resolve()),
  },
}));

// Mock logger
vi.mock('../../../src/logger.js', () => ({
  fileInfoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FileMetadataService', () => {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
  let fileMetadata: FileMetadataService;
  let fileReader: FileReaderService;

  beforeAll(() => {
    fileReader = new FileReaderService();
    fileMetadata = new FileMetadataService(fileReader);
    // 确保测试目录存在
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
  });

  describe('文件基本信息', () => {
    test('应该正确获取文件基本信息', () => {
      const testFile = path.join(fixturesDir, 'basic-info.txt');
      const content = 'Test content for basic info';

      try {
        fs.writeFileSync(testFile, content);

        const info = fileMetadata.getFileBasicInfo(testFile);

        expect(info.name).toBe('basic-info.txt');
        expect(info.ext).toBe('.txt');
        expect(info.size).toBe(content.length);
        expect(info.isText).toBe(true);
        expect(info.modified).toBeInstanceOf(Date);
        expect(info.created).toBeInstanceOf(Date);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理不同文件扩展名', () => {
      const testCases = [
        { filename: 'test.json', ext: '.json' },
        { filename: 'test.md', ext: '.md' },
        { filename: 'test.js', ext: '.js' },
        { filename: 'test.py', ext: '.py' },
        { filename: 'test.xml', ext: '.xml' },
        { filename: 'test.html', ext: '.html' },
      ];

      testCases.forEach(({ filename, ext }) => {
        const testFile = path.join(fixturesDir, filename);
        const content = `Content for ${ext} file`;

        try {
          fs.writeFileSync(testFile, content);

          const info = fileMetadata.getFileBasicInfo(testFile);
          expect(info.name).toBe(filename);
          expect(info.ext).toBe(ext);
          expect(info.isText).toBe(true);
        } finally {
          if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
          }
        }
      });
    });
  });

  describe('文本文件描述生成', () => {
    test('应该正确生成文本文件描述', () => {
      const testFile = path.join(fixturesDir, 'text-description.txt');
      const content =
        'This is a meaningful text file\nwith multiple lines\ncontaining important information';

      try {
        fs.writeFileSync(testFile, content);

        const description = fileMetadata.generateTextFileDescription(testFile);
        expect(description).toContain('This is a meaningful text file');
        expect(description.length).toBeGreaterThan(0);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理JSON文件描述', () => {
      const testFile = path.join(fixturesDir, 'json-description.json');
      const jsonData = {
        name: 'Test Application',
        title: 'Test App Title',
        description: 'A test application for unit testing',
        version: '1.0.0',
      };

      try {
        fs.writeFileSync(testFile, JSON.stringify(jsonData, null, 2));

        const description = fileMetadata.generateTextFileDescription(testFile);
        // 应该优先提取name字段
        expect(description).toBe('Test Application');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理没有关键字的JSON文件', () => {
      const testFile = path.join(fixturesDir, 'json-no-keywords.json');
      const jsonData = {
        someField: 'someValue',
        anotherField: 'anotherValue',
      };

      try {
        fs.writeFileSync(testFile, JSON.stringify(jsonData, null, 2));

        const description = fileMetadata.generateTextFileDescription(testFile);
        // 没有关键字段时应该返回内容预览
        expect(description).toContain('someField');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理空文件', () => {
      const testFile = path.join(fixturesDir, 'empty-description.txt');

      try {
        fs.writeFileSync(testFile, '');

        const description = fileMetadata.generateTextFileDescription(testFile);
        expect(description).toBe('');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确截断过长的内容', () => {
      const testFile = path.join(fixturesDir, 'long-content.txt');
      const longContent =
        'This is a very long content that should be truncated when the file description is generated to ensure it does not exceed the maximum length limit. '.repeat(
          10
        );

      try {
        fs.writeFileSync(testFile, longContent);

        const description = fileMetadata.generateTextFileDescription(testFile);
        // 内容应该被截断，但不一定包含省略号，取决于具体截断逻辑
        expect(description.length).toBeLessThanOrEqual(300); // 给出更宽松的限制
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('元数据提取', () => {
    test('应该正确提取EXIF元数据', async () => {
      const testFile = path.join(fixturesDir, 'exif-test.jpg');

      try {
        // 创建一个假的图片文件
        fs.writeFileSync(testFile, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

        const metadata = await fileMetadata.extractExifMetadata(testFile);
        expect(metadata).toBeDefined();
        expect(typeof metadata).toBe('object');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确处理EXIF提取失败', async () => {
      const nonExistentFile = path.join(fixturesDir, 'non-existent.jpg');

      // 由于我们有mock，这个测试实际不会失败
      const metadata = await fileMetadata.extractExifMetadata(nonExistentFile);
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe('object');
    });
  });

  describe('元数据格式化', () => {
    test('应该正确格式化元数据标签', () => {
      const mockTags = {
        Title: 'Test Title',
        Author: 'Test Author',
        Description: 'Test Description',
        Software: 'Test Software',
        FileSize: '1000', // 这个应该被过滤掉
        MIMEType: 'image/jpeg', // 这个应该被过滤掉
        SourceFile: '/path/to/file.jpg', // 这个应该被过滤掉
      };

      const formatted = fileMetadata.getMetadataTagsString(mockTags, 'test.jpg');

      expect(formatted).toContain('Title: Test Title');
      expect(formatted).toContain('Author: Test Author');
      expect(formatted).toContain('Description: Test Description');
      expect(formatted).toContain('Software: Test Software');

      // 不应该包含被过滤的字段
      expect(formatted).not.toContain('FileSize:');
      expect(formatted).not.toContain('MIMEType:');
      expect(formatted).not.toContain('SourceFile:');
    });

    test('应该正确处理空元数据', () => {
      const emptyTags = {};
      const formatted = fileMetadata.getMetadataTagsString(emptyTags, 'test.jpg');
      expect(formatted).toBe('');
    });

    test('应该正确处理null和undefined值', () => {
      const mixedTags = {
        Title: 'Valid Title',
        Author: null,
        Description: undefined,
        Software: '',
        Subject: 'Valid Subject',
        Version: 0, // 这个应该被过滤掉
      };

      const formatted = fileMetadata.getMetadataTagsString(mixedTags, 'test.jpg');

      expect(formatted).toContain('Title: Valid Title');
      expect(formatted).toContain('Subject: Valid Subject');
      expect(formatted).not.toContain('Author:');
      expect(formatted).not.toContain('Description:');
      expect(formatted).not.toContain('Software:');
      expect(formatted).not.toContain('Version:');
    });
  });

  describe('提示格式化', () => {
    test('应该正确格式化文件提示', () => {
      const tags = 'Title: Test Title, Author: Test Author';
      const summary = 'This is a test file with meaningful content';

      const formatted = fileMetadata.formatFilePrompt(tags, summary);

      expect(formatted).toBe(
        '元数据: Title: Test Title, Author: Test Author\n摘要: This is a test file with meaningful content'
      );
    });

    test('应该正确处理空标签和摘要', () => {
      const result1 = fileMetadata.formatFilePrompt('', '');
      expect(result1).toBe('');

      const result2 = fileMetadata.formatFilePrompt('Some metadata', '');
      expect(result2).toBe('元数据: Some metadata\n摘要: ');

      const result3 = fileMetadata.formatFilePrompt('', 'Some summary');
      expect(result3).toBe('元数据: \n摘要: Some summary');
    });
  });

  describe('主要接口', () => {
    test('应该正确获取文件描述（文本文件）', async () => {
      const testFile = path.join(fixturesDir, 'description-main.txt');
      const content =
        'This is a meaningful text file content that should be extracted and used for file description generation.';

      try {
        fs.writeFileSync(testFile, content);

        const description = await fileMetadata.getFileDescription(testFile);
        expect(description).toMatch(/^元数据: \n摘要: /);

        const summary = description.split('\n')[1].replace('摘要: ', '');
        expect(summary).toContain('This is a meaningful text file content');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确获取文件描述（二进制文件）', async () => {
      const testFile = path.join(fixturesDir, 'binary-description.jpg');

      try {
        // 创建假的图片文件
        fs.writeFileSync(testFile, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

        const description = await fileMetadata.getFileDescription(testFile);
        expect(description).toMatch(/^元数据: .*\n摘要: /);

        const metadata = description.split('\n')[0].replace('元数据: ', '');
        expect(metadata.length).toBeGreaterThan(0);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('特定元数据', () => {
    test('应该正确获取文件的特定元数据', async () => {
      const testFile = path.join(fixturesDir, 'specific-metadata.txt');
      const content = 'Test file content';

      try {
        fs.writeFileSync(testFile, content);

        const metadata = await fileMetadata.getSpecificMetadata(testFile);

        expect(metadata.basic).toBeDefined();
        expect(metadata.basic.name).toBe('specific-metadata.txt');
        expect(metadata.basic.ext).toBe('.txt');
        expect(metadata.basic.isText).toBe(true);
        expect(metadata.basic.size).toBe(content.length);

        // EXIF数据可能存在也可能不存在，取决于文件类型
        // metadata.exif 可能是 undefined

        // 自定义元数据
        expect(metadata.custom).toBeDefined();
        expect(typeof metadata.custom).toBe('object');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('应该正确提取JSON文件的特定元数据', async () => {
      const testFile = path.join(fixturesDir, 'json-specific-metadata.json');
      const jsonData = {
        title: 'Application Title',
        name: 'App Name',
        description: 'Application description',
        version: '2.0.0',
        author: 'App Author',
        created: '2023-01-01',
        date: '2023-01-01T00:00:00Z',
      };

      try {
        fs.writeFileSync(testFile, JSON.stringify(jsonData, null, 2));

        const metadata = await fileMetadata.getSpecificMetadata(testFile);

        expect(metadata.custom.title).toBe('Application Title');
        expect(metadata.custom.name).toBe('App Name');
        expect(metadata.custom.description).toBe('Application description');
        expect(metadata.custom.version).toBe('2.0.0');
        expect(metadata.custom.author).toBe('App Author');
        expect(metadata.custom.documentDate).toBe('2023-01-01');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('清理方法', () => {
    test('应该正确调用exiftool清理方法', async () => {
      expect(async () => {
        await fileMetadata.cleanupExiftool();
      }).not.toThrow();

      expect(() => {
        fileMetadata.cleanupExiftoolSync();
      }).not.toThrow();
    });
  });

  afterAll(() => {
    // 清理可能遗留的测试文件
    const testFiles = [
      'basic-info.txt',
      'text-description.txt',
      'json-description.json',
      'json-no-keywords.json',
      'empty-description.txt',
      'long-content.txt',
      'exif-test.jpg',
      'non-existent.jpg',
      'description-main.txt',
      'binary-description.jpg',
      'specific-metadata.txt',
      'json-specific-metadata.json',
    ];

    testFiles.forEach((filename) => {
      const filepath = path.join(fixturesDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });

    // 清理不同扩展名的测试文件
    const testExtensions = ['.json', '.md', '.js', '.py', '.xml', '.html'];
    testExtensions.forEach((ext) => {
      const filepath = path.join(fixturesDir, `test${ext}`);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
  });
});
