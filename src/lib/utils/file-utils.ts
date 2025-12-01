import fs from 'node:fs';
import path from 'node:path';

/**
 * 文件相关工具函数
 */
export class FileUtils {
  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取文件大小（格式化）
   */
  static getFileSize(filePath: string): string {
    try {
      const fileStats = fs.statSync(filePath);
      return this.formatFileSize(fileStats.size);
    } catch {
      return '0 B';
    }
  }

  /**
   * 分批处理工具函数
   */
  static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 获取文件扩展名
   */
  static getFileExtension(fileName: string): string {
    return path.extname(fileName).toLowerCase() || '无扩展名';
  }

  /**
   * 检查文件是否存在
   */
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 确保目录存在
   */
  static ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
