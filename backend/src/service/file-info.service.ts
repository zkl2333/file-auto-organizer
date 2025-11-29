import { TEXT_FILE_CONFIG } from "./file-processing/file-reader.service.js";
import { FileReaderService } from "./file-processing/file-reader.service.js";
import { FileValidatorService } from "./file-processing/file-validator.service.js";
import { FileMetadataService } from "./file-processing/file-metadata.service.js";

// 重新导出配置以保持向后兼容
export { TEXT_FILE_CONFIG };

/**
 * 文件信息服务 - 协调器，负责协调各个文件处理子服务
 *
 * 重构说明：
 * - 将原本638行的单体服务拆分为多个专门的服务
 * - 该类作为协调器，提供统一的接口
 * - 保持向后兼容性，不破坏现有调用
 */
export class FileInfoService {
  private fileReader: FileReaderService;
  private fileValidator: FileValidatorService;
  private fileMetadata: FileMetadataService;

  constructor() {
    this.fileReader = new FileReaderService();
    this.fileValidator = new FileValidatorService();
    this.fileMetadata = new FileMetadataService(this.fileReader);
  }

  /**
   * 获取文件描述信息（供外部调用）
   * 保持原有接口不变
   */
  async getFileDescription(filePath: string): Promise<string> {
    // 预检查文件
    const validation = this.fileValidator.validateFile(filePath);
    if (!validation.valid) {
      return this.fileMetadata.formatFilePrompt("", "");
    }

    // 委托给元数据服务
    return this.fileMetadata.getFileDescription(filePath);
  }

  /**
   * 公共方法：检查文件是否为文本文件
   * 委托给文件读取服务
   */
  public checkIsTextFile(filePath: string): boolean {
    return this.fileReader.checkIsTextFile(filePath);
  }

  /**
   * 公共方法：读取文本文件的前几行
   * 委托给文件读取服务
   */
  public getTextFilePreview(
    filePath: string,
    maxLines: number = TEXT_FILE_CONFIG.MAX_PREVIEW_LINES,
    maxChars: number = TEXT_FILE_CONFIG.MAX_PREVIEW_CHARS
  ): string[] {
    return this.fileReader.getTextFilePreview(filePath, maxLines, maxChars);
  }

  /**
   * 公共方法：流式读取文本文件的完整内容
   * 委托给文件读取服务
   */
  public getTextFileContent(
    filePath: string,
    maxSize: number = TEXT_FILE_CONFIG.MAX_FILE_SIZE
  ): string {
    return this.fileReader.getTextFileContent(filePath, maxSize);
  }

  /**
   * 公共方法：流式读取文件内容（支持回调处理每个块）
   * 委托给文件读取服务
   */
  public readFileStream(
    filePath: string,
    chunkProcessor: (chunk: string, isLast: boolean) => boolean,
    options: {
      encoding?: BufferEncoding;
      chunkSize?: number;
      maxSize?: number;
    } = {}
  ): { totalBytesRead: number; stopped: boolean } {
    return this.fileReader.readFileStream(filePath, chunkProcessor, options);
  }

  /**
   * 公共方法：获取文件指定部分内容
   * 委托给文件读取服务
   */
  public getFileSegment(
    filePath: string,
    startByte: number = 0,
    maxBytes: number = 1024 * 1024,
    encoding: BufferEncoding = "utf8"
  ): string {
    return this.fileReader.getFileSegment(filePath, startByte, maxBytes, encoding);
  }

  /**
   * 公共方法：获取文件基本信息
   * 委托给元数据服务
   */
  public getFileBasicInfo(filePath: string): {
    name: string;
    ext: string;
    size: number;
    isText: boolean;
    modified: Date;
    created: Date;
  } {
    return this.fileMetadata.getFileBasicInfo(filePath);
  }

  /**
   * 验证文件（新增接口）
   * 委托给验证服务
   */
  public validateFile(filePath: string): { valid: boolean; error?: string } {
    return this.fileValidator.validateFile(filePath);
  }

  /**
   * 获取详细的文件元数据（新增接口）
   * 委托给元数据服务
   */
  public async getSpecificMetadata(filePath: string): Promise<{
    basic: ReturnType<FileMetadataService["getFileBasicInfo"]>;
    exif?: any;
    custom?: Record<string, any>;
  }> {
    return this.fileMetadata.getSpecificMetadata(filePath);
  }

  /**
   * 程序退出时关闭 exiftool (异步)
   * 委托给元数据服务
   */
  public async cleanupExiftool() {
    await this.fileMetadata.cleanupExiftool();
  }

  /**
   * 程序退出时关闭 exiftool (同步)
   * 委托给元数据服务
   */
  public cleanupExiftoolSync() {
    this.fileMetadata.cleanupExiftoolSync();
  }
}

// 导出清理函数供进程管理器调用
const fileInfoService = new FileInfoService();

export async function cleanupFileInfo() {
  await fileInfoService.cleanupExiftool();
}

export function cleanupFileInfoSync() {
  fileInfoService.cleanupExiftoolSync();
}