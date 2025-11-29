/**
 * 测试工具类 - 减少重复代码和统一测试模式
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TestUtils {
  private static readonly fixturesDir = path.join(__dirname, '..', 'fixtures');
  private static readonly createdFiles = new Set<string>();
  private static readonly createdDirs = new Set<string>();

  /**
   * 确保测试目录存在
   */
  static ensureFixturesDir(): void {
    if (!fs.existsSync(this.fixturesDir)) {
      fs.mkdirSync(this.fixturesDir, { recursive: true });
    }
  }

  /**
   * 创建测试文件
   */
  static createTestFile(fileName: string, content: string | Buffer): string {
    this.ensureFixturesDir();
    const filePath = path.join(this.fixturesDir, fileName);

    fs.writeFileSync(filePath, content);
    this.createdFiles.add(filePath);

    return filePath;
  }

  /**
   * 创建测试目录
   */
  static createTestDir(dirName: string): string {
    this.ensureFixturesDir();
    const dirPath = path.join(this.fixturesDir, dirName);

    fs.mkdirSync(dirPath, { recursive: true });
    this.createdDirs.add(dirPath);

    return dirPath;
  }

  /**
   * 创建二进制测试文件
   */
  static createBinaryTestFile(fileName: string, signature: number[]): string {
    const fileBuffer = Buffer.from(signature.concat(Array(100).fill(0)));
    return this.createTestFile(fileName, fileBuffer);
  }

  /**
   * 创建JSON测试文件
   */
  static createJsonTestFile(fileName: string, data: object): string {
    return this.createTestFile(fileName, JSON.stringify(data, null, 2));
  }

  /**
   * 创建文本测试文件
   */
  static createTextTestFile(fileName: string, lines: string[]): string {
    return this.createTestFile(fileName, lines.join('\n'));
  }

  /**
   * 创建长文本测试文件
   */
  static createLongTextFile(fileName: string, baseContent: string, targetSize: number): string {
    let content = baseContent;
    while (content.length < targetSize) {
      content += '\n' + baseContent;
    }
    return this.createTestFile(fileName, content);
  }

  /**
   * 清理测试文件和目录
   */
  static cleanup(): void {
    // 清理文件
    for (const filePath of this.createdFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn(`清理测试文件失败: ${filePath}`, err);
      }
    }

    // 清理目录
    for (const dirPath of this.createdDirs) {
      try {
        if (fs.existsSync(dirPath)) {
          fs.rmdirSync(dirPath, { recursive: true });
        }
      } catch (err) {
        console.warn(`清理测试目录失败: ${dirPath}`, err);
      }
    }

    this.createdFiles.clear();
    this.createdDirs.clear();
  }

  /**
   * 获取测试文件路径
   */
  static getTestFilePath(fileName: string): string {
    return path.join(this.fixturesDir, fileName);
  }

  /**
   * 检查文件是否存在
   */
  static fileExists(fileName: string): boolean {
    return fs.existsSync(this.getTestFilePath(fileName));
  }

  /**
   * 读取测试文件内容
   */
  static readTestFile(fileName: string): Buffer {
    return fs.readFileSync(this.getTestFilePath(fileName));
  }

  /**
   * 生成随机测试文件名
   */
  static generateRandomFileName(prefix = 'test', extension = '.txt'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}_${timestamp}_${random}${extension}`;
  }

  /**
   * 创建各种文件类型的测试文件集合
   */
  static createTestFileSuite(): Record<string, string> {
    const files: Record<string, string> = {};

    // 文本文件
    files.text = this.createTextTestFile('sample.txt', [
      'Line 1: This is a sample text file',
      'Line 2: Used for testing purposes',
      'Line 3: Contains multiple lines',
    ]);

    // JSON文件
    files.json = this.createJsonTestFile('sample.json', {
      name: 'Test Application',
      title: 'Test App Title',
      description: 'A test application for unit testing',
      version: '1.0.0',
      author: 'Test Author',
    });

    // 二进制文件（JPEG签名）
    files.binary = this.createBinaryTestFile('sample.jpg', [0xff, 0xd8, 0xff, 0xe0]);

    // 空文件
    files.empty = this.createTestFile('empty.txt', '');

    // 大文件（相对较小的测试文件）
    files.large = this.createLongTextFile('large.txt', 'This is a large test file. ', 2048);

    return files;
  }

  /**
   * 测试文件是否存在并可读
   */
  static validateTestFile(filePath: string): { exists: boolean; readable: boolean; size: number } {
    try {
      const exists = fs.existsSync(filePath);
      if (!exists) {
        return { exists: false, readable: false, size: 0 };
      }

      const stats = fs.statSync(filePath);
      return {
        exists: true,
        readable: true,
        size: stats.size,
      };
    } catch {
      return { exists: false, readable: false, size: 0 };
    }
  }
}
