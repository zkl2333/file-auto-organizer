/**
 * FileInfoService 单元测试
 */

import { test, describe, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Vitest mock配置
vi.mock('exiftool-vendored', () => ({
  exiftool: {
    read: vi.fn(() => Promise.resolve({})),
    end: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../src/logger.js', () => ({
  fileInfoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// 导入被模拟的模块
import { FileInfoService } from '../../src/service/file-info.service.js';

describe('FileInfoService 核心功能测试', () => {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

  beforeAll(() => {
    // 确保测试目录存在
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
  });

  test('应该能够读取文本文件', () => {
    const testFile = path.join(fixturesDir, 'read-test.txt');
    const content = 'Hello, World!';

    // 创建测试文件
    fs.writeFileSync(testFile, content);

    try {
      // 测试文件读取
      const readContent = fs.readFileSync(testFile, 'utf8');
      expect(readContent).toBe(content);

      // 测试文件状态
      const stats = fs.statSync(testFile);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    } finally {
      // 清理测试文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });

  test('应该能够检测文件类型', () => {
    const textFile = path.join(fixturesDir, 'type-test.txt');
    const jsonFile = path.join(fixturesDir, 'type-test.json');

    // 创建不同类型的测试文件
    fs.writeFileSync(textFile, 'This is a text file');
    fs.writeFileSync(jsonFile, '{"name": "test"}');

    try {
      // 测试扩展名检测
      expect(path.extname(textFile)).toBe('.txt');
      expect(path.extname(jsonFile)).toBe('.json');

      // 测试文件名提取
      expect(path.basename(textFile)).toBe('type-test.txt');
      expect(path.basename(jsonFile)).toBe('type-test.json');
    } finally {
      // 清理测试文件
      [textFile, jsonFile].forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }
  });

  test('应该能够处理JSON文件', () => {
    const jsonFile = path.join(fixturesDir, 'json-test.json');
    const jsonData = {
      name: 'TestApp',
      version: '1.0.0',
      description: 'A test application',
    };

    // 创建JSON测试文件
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));

    try {
      // 读取并解析JSON
      const content = fs.readFileSync(jsonFile, 'utf8');
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe('TestApp');
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.description).toBe('A test application');
    } finally {
      // 清理测试文件
      if (fs.existsSync(jsonFile)) {
        fs.unlinkSync(jsonFile);
      }
    }
  });

  test('应该能够处理大文件读取', () => {
    const largeFile = path.join(fixturesDir, 'large-test.txt');
    const chunkSize = 1024;
    const content = 'A'.repeat(5000); // 5KB内容

    // 创建大文件
    fs.writeFileSync(largeFile, content);

    try {
      // 测试分块读取
      const fd = fs.openSync(largeFile, 'r');
      const buffer = Buffer.alloc(chunkSize);
      const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, 0);
      fs.closeSync(fd);

      expect(bytesRead).toBe(chunkSize);
      expect(buffer.toString('utf8', 0, bytesRead)).toBe('A'.repeat(chunkSize));
    } finally {
      // 清理测试文件
      if (fs.existsSync(largeFile)) {
        fs.unlinkSync(largeFile);
      }
    }
  });

  test('应该能够检测各种二进制文件签名', () => {
    const testCases = [
      {
        name: 'PNG',
        extension: '.png',
        signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        expectBinary: true,
      },
      {
        name: 'JPEG',
        extension: '.jpg',
        signature: [0xff, 0xd8, 0xff, 0xe0],
        expectBinary: true,
      },
      {
        name: 'GIF',
        extension: '.gif',
        signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
        expectBinary: true,
      },
      {
        name: 'PDF',
        extension: '.pdf',
        signature: [0x25, 0x50, 0x44, 0x46, 0x2d],
        expectBinary: true,
      },
      {
        name: 'ZIP',
        extension: '.zip',
        signature: [0x50, 0x4b, 0x03, 0x04],
        expectBinary: true,
      },
      {
        name: 'RAR',
        extension: '.rar',
        signature: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07],
        expectBinary: true,
      },
      {
        name: 'ELF',
        extension: '.elf',
        signature: [0x7f, 0x45, 0x4c, 0x46],
        expectBinary: true,
      },
      {
        name: 'EXE',
        extension: '.exe',
        signature: [0x4d, 0x5a],
        expectBinary: true,
      },
    ];

    testCases.forEach(({ name, extension, signature, expectBinary }) => {
      const testFile = path.join(fixturesDir, `binary-${name.toLowerCase()}${extension}`);

      try {
        // 创建包含特定签名的文件
        const fileBuffer = Buffer.from(signature.concat(Array(100).fill(0))); // 添加一些填充数据
        fs.writeFileSync(testFile, fileBuffer);

        // 验证文件头签名
        const fd = fs.openSync(testFile, 'r');
        const buffer = Buffer.alloc(signature.length);
        const bytesRead = fs.readSync(fd, buffer, 0, signature.length, 0);
        fs.closeSync(fd);

        expect(bytesRead).toBe(signature.length);

        // 验证签名字节
        signature.forEach((expectedByte, index) => {
          expect(buffer[index]).toBe(expectedByte);
        });

        // 验证FileInfoService能正确识别为二进制文件
        const service = new FileInfoService();
        const isText = service.checkIsTextFile(testFile);
        expect(isText).toBe(!expectBinary);
      } finally {
        // 清理测试文件
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  test('应该能够处理文件错误', () => {
    const nonExistentFile = path.join(fixturesDir, 'does-not-exist.txt');

    // 确保文件不存在
    if (fs.existsSync(nonExistentFile)) {
      fs.unlinkSync(nonExistentFile);
    }

    // 测试文件不存在的情况
    expect(() => {
      fs.readFileSync(nonExistentFile);
    }).toThrow();

    expect(fs.existsSync(nonExistentFile)).toBe(false);
  });

  test('应该能够获取文件统计信息', () => {
    const testFile = path.join(fixturesDir, 'stats-test.txt');
    const content = 'File statistics test';

    // 创建测试文件
    fs.writeFileSync(testFile, content);

    try {
      const stats = fs.statSync(testFile);

      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(stats.size).toBe(content.length);
      expect(stats.mtime).toBeDefined();
      expect(stats.birthtime || stats.ctime).toBeDefined();
      expect(typeof stats.mtime.getTime()).toBe('number');
      expect(typeof (stats.birthtime || stats.ctime).getTime()).toBe('number');
    } finally {
      // 清理测试文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });

  test('应该能够测试FileInfoService方法', async () => {
    const service = new FileInfoService();

    // 测试文本文件检测方法
    const textFile = path.join(fixturesDir, 'service-test.txt');
    fs.writeFileSync(textFile, 'This is a test file for service methods');

    try {
      // 测试checkIsTextFile方法
      expect(service.checkIsTextFile(textFile)).toBe(true);

      // 测试getTextFilePreview方法
      const preview = service.getTextFilePreview(textFile, 2, 50);
      expect(preview).toHaveLength(1);
      expect(preview[0]).toContain('This is a test file');

      // 测试getTextFileContent方法
      const content = service.getTextFileContent(textFile);
      expect(content).toBe('This is a test file for service methods');

      // 测试getFileBasicInfo方法
      const info = service.getFileBasicInfo(textFile);
      expect(info.name).toBe('service-test.txt');
      expect(info.ext).toBe('.txt');
      expect(info.isText).toBe(true);

      // 测试getFileDescription方法 - 新格式验证
      const description = await service.getFileDescription(textFile);
      expect(typeof description).toBe('string');
      expect(description).toMatch(/^元数据: .*\n摘要: .*$/);

      // 验证文本文件返回格式
      const lines = description.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatch(/^元数据: /);
      expect(lines[1]).toMatch(/^摘要: /);

      // 测试getFileSegment方法
      const segment = service.getFileSegment(textFile, 0, 10);
      expect(segment).toBe('This is a ');

      // 测试readFileStream方法
      let streamContent = '';
      const streamResult = service.readFileStream(
        textFile,
        (chunk, isLast) => {
          streamContent += chunk;
          return true;
        },
        { chunkSize: 10 }
      );

      expect(streamResult.stopped).toBe(false);
      expect(streamResult.totalBytesRead).toBeGreaterThan(0);
      expect(streamContent).toContain('This is a test file');
    } finally {
      if (fs.existsSync(textFile)) {
        fs.unlinkSync(textFile);
      }
    }
  });

  test('getFileDescription应该为不同文件类型返回正确格式', async () => {
    const service = new FileInfoService();

    // 测试空文本文件
    const emptyTextFile = path.join(fixturesDir, 'empty-description-test.txt');
    fs.writeFileSync(emptyTextFile, '');

    try {
      const emptyDescription = await service.getFileDescription(emptyTextFile);
      expect(emptyDescription).toBe('');
    } finally {
      if (fs.existsSync(emptyTextFile)) {
        fs.unlinkSync(emptyTextFile);
      }
    }

    // 测试有内容的文本文件
    const contentTextFile = path.join(fixturesDir, 'content-description-test.txt');
    fs.writeFileSync(
      contentTextFile,
      'This is a meaningful content\nWith multiple lines\nContaining important information'
    );

    try {
      const contentDescription = await service.getFileDescription(contentTextFile);
      expect(contentDescription).toMatch(/^元数据: \n摘要: /);
      const summary = contentDescription.split('\n')[1].replace('摘要: ', '');
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).toContain('This is a meaningful content');
    } finally {
      if (fs.existsSync(contentTextFile)) {
        fs.unlinkSync(contentTextFile);
      }
    }

    // 测试JSON文件
    const jsonFile = path.join(fixturesDir, 'description-test.json');
    const jsonData = { name: 'TestApp', title: 'Test Application' };
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData));

    try {
      const jsonDescription = await service.getFileDescription(jsonFile);
      expect(jsonDescription).toMatch(/^元数据: \n摘要: /);
      const summary = jsonDescription.split('\n')[1].replace('摘要: ', '');
      expect(summary).toBe('TestApp'); // JSON文件应该提取name字段
    } finally {
      if (fs.existsSync(jsonFile)) {
        fs.unlinkSync(jsonFile);
      }
    }
  });

  test('getFileDescription应该正确处理备用情况', async () => {
    const service = new FileInfoService();

    // 测试不存在的文件
    const nonExistentFile = path.join(fixturesDir, 'non-existent-file.txt');

    const fallbackDescription = await service.getFileDescription(nonExistentFile);
    expect(fallbackDescription).toBe('');
  });

  test('getFileDescription应该处理各种已知文件类型', async () => {
    const service = new FileInfoService();

    const testCases = [
      { ext: '.md', content: '# Markdown File\nThis is a markdown document' },
      { ext: '.js', content: 'console.log("Hello World");' },
      { ext: '.py', content: 'print("Hello World")' },
      { ext: '.html', content: '<html><body>Hello</body></html>' },
      { ext: '.css', content: 'body { color: red; }' },
      { ext: '.xml', content: '<?xml version="1.0"?><root>data</root>' },
    ];

    for (const testCase of testCases) {
      const testFile = path.join(fixturesDir, `type-test${testCase.ext}`);
      fs.writeFileSync(testFile, testCase.content);

      try {
        const description = await service.getFileDescription(testFile);
        expect(description).toMatch(/^元数据: \n摘要: /);

        // 文本文件应该有摘要（如果内容有意义）
        const summary = description.split('\n')[1].replace('摘要: ', '');
        expect(summary.length).toBeGreaterThan(0);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    }
  });

  test('应该能够处理文件编码', () => {
    const testFile = path.join(fixturesDir, 'encoding-test.txt');
    const content = 'Hello 世界 🌍';

    // 创建包含多语言字符的测试文件
    fs.writeFileSync(testFile, content, 'utf8');

    try {
      // 测试UTF-8读取
      const utf8Content = fs.readFileSync(testFile, 'utf8');
      expect(utf8Content).toBe(content);

      // 测试Buffer读取
      const buffer = fs.readFileSync(testFile);
      const decodedContent = buffer.toString('utf8');
      expect(decodedContent).toBe(content);
    } finally {
      // 清理测试文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });

  afterAll(() => {
    // 清理所有可能遗留的测试文件
    const testFiles = [
      'read-test.txt',
      'type-test.txt',
      'type-test.json',
      'json-test.json',
      'large-test.txt',
      'binary-test.bin',
      'stats-test.txt',
      'encoding-test.txt',
      // 二进制文件测试文件
      'binary-png.png',
      'binary-jpeg.jpg',
      'binary-gif.gif',
      'binary-pdf.pdf',
      'binary-zip.zip',
      'binary-rar.rar',
      'binary-elf.elf',
      'binary-exe.exe',
      // 服务方法测试文件
      'service-test.txt',
      // getFileDescription 测试文件
      'empty-description-test.txt',
      'content-description-test.txt',
      'description-test.json',
      'non-existent-file.txt',
      'type-test.md',
      'type-test.js',
      'type-test.py',
      'type-test.html',
      'type-test.css',
      'type-test.xml',
    ];

    testFiles.forEach((filename) => {
      const filepath = path.join(fixturesDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
  });
});
