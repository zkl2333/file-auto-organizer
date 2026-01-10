import { logger } from '@/lib/logger';
import { FileReaderService, FileMetadataService, FileValidatorService } from './file-processing';

/**
 * 文件信息服务 - 使用专业的子服务
 */
export class FileInfoService {
  private static instance: FileInfoService | null = null;
  private fileReader: FileReaderService;
  private fileMetadata: FileMetadataService;
  private validator: FileValidatorService;

  private constructor() {
    this.fileReader = new FileReaderService();
    this.fileMetadata = new FileMetadataService(this.fileReader);
    this.validator = new FileValidatorService();
  }

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
    // 先验证文件是否适合处理
    const validation = this.validator.validateFileForProcessing(filePath);
    if (!validation.valid) {
      logger.warn(
        { module: 'file-info', filePath, reason: validation.reason },
        '文件验证失败，跳过提取描述'
      );
      return '';
    }

    try {
      return await this.fileMetadata.getFileDescription(filePath);
    } catch (error) {
      logger.error({ module: 'file-info', filePath, error }, '获取文件描述失败');
      return '';
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      await this.fileMetadata.cleanupExiftool();
      logger.debug({ module: 'file-info' }, 'ExifTool 清理完成');
    } catch (error) {
      logger.warn({ module: 'file-info', error }, 'ExifTool 清理失败');
    }
  }

  /**
   * 获取性能指标（来自 FileReaderService）
   */
  getPerformanceMetrics() {
    return this.fileReader.getPerformanceMetrics();
  }
}

/**
 * 清理函数（供外部调用）
 */
export async function cleanupFileInfo(): Promise<void> {
  const service = FileInfoService.getInstance();
  await service.cleanup();
}
