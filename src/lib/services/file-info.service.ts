import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';
import { exiftool } from 'exiftool-vendored';

/**
 * 文件信息服务
 */
export class FileInfoService {
  private static instance: FileInfoService | null = null;

  /**
   * 获取单例实例
   */
  static getInstance(): FileInfoService {
    if (!FileInfoService.instance) {
      FileInfoService.instance = new FileInfoService();
    }
    return FileInfoService.instance;
  }

  /**
   * 获取文件描述信息
   */
  async getFileDescription(filePath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        return '';
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      const sizeKB = Math.round(stats.size / 1024);

      let description = `文件名: ${fileName}, 大小: ${sizeKB}KB`;

      // 对于图片文件，尝试获取 EXIF 信息
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(ext)) {
        try {
          const metadata = await exiftool.read(filePath);
          if (metadata.ImageWidth && metadata.ImageHeight) {
            description += `, 尺寸: ${metadata.ImageWidth}x${metadata.ImageHeight}`;
          }
          if (metadata.DateTimeOriginal) {
            description += `, 拍摄时间: ${metadata.DateTimeOriginal}`;
          }
        } catch (error) {
          // 忽略 EXIF 读取错误
          logger.debug(
            { module: 'file-info', filePath, error },
            '读取 EXIF 信息失败，使用基本信息'
          );
        }
      }

      // 对于文本文件，尝试读取前几行
      if (this.isTextFile(ext)) {
        try {
          const content = fs.readFileSync(filePath, { encoding: 'utf8' });
          const lines = content.split('\n').slice(0, 3).join(' ');
          const preview = lines.substring(0, 200);
          if (preview) {
            description += `, 内容预览: ${preview}`;
          }
        } catch (error) {
          // 忽略读取错误
          logger.debug({ module: 'file-info', filePath, error }, '读取文本文件失败，使用基本信息');
        }
      }

      return description;
    } catch (error) {
      logger.error({ module: 'file-info', filePath, error }, '获取文件描述失败');
      return '';
    }
  }

  /**
   * 判断是否为文本文件
   */
  private isTextFile(ext: string): boolean {
    const textExtensions = [
      '.txt',
      '.md',
      '.json',
      '.xml',
      '.html',
      '.css',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.c',
      '.cpp',
      '.h',
      '.go',
      '.rs',
      '.php',
      '.rb',
      '.sh',
      '.yml',
      '.yaml',
      '.csv',
      '.log',
    ];
    return textExtensions.includes(ext.toLowerCase());
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      await exiftool.end();
      logger.debug({ module: 'file-info' }, 'ExifTool 清理完成');
    } catch (error) {
      logger.warn({ module: 'file-info', error }, 'ExifTool 清理失败');
    }
  }
}

/**
 * 清理函数（供外部调用）
 */
export async function cleanupFileInfo(): Promise<void> {
  const service = FileInfoService.getInstance();
  await service.cleanup();
}
