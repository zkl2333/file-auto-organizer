import path from 'node:path';
import fs from 'node:fs';
import { exiftool, Tags } from 'exiftool-vendored';
import { logger } from '@/lib/logger';
import { TEXT_FILE_CONFIG, FileReaderService } from './file-reader.service';

/**
 * 文件元数据服务 - 专注于元数据提取和基本信息获取
 */
export class FileMetadataService {
  constructor(private fileReader: FileReaderService) {}

  /**
   * 获取文件基本信息
   */
  getFileBasicInfo(filePath: string): {
    name: string;
    ext: string;
    size: number;
    isText: boolean;
    modified: Date;
    created: Date;
  } {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    return {
      name: fileName,
      ext,
      size: stats.size,
      isText: this.fileReader.checkIsTextFile(filePath),
      modified: stats.mtime,
      created: stats.birthtime || stats.ctime,
    };
  }

  /**
   * 为文本文件生成描述（AI优化版：省略已知文件类型）
   */
  generateTextFileDescription(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    // 读取文件的前几行
    const lines = this.fileReader.readTextFileLines(
      filePath,
      Math.min(3, TEXT_FILE_CONFIG.MAX_PREVIEW_LINES),
      Math.min(300, TEXT_FILE_CONFIG.MAX_PREVIEW_CHARS)
    );

    // 特殊处理：JSON文件尝试提取关键信息
    if (ext === '.json') {
      try {
        const content = this.fileReader.getFileSegment(filePath, 0, 8192);

        try {
          const jsonData = JSON.parse(content);
          if (jsonData.name) {
            return jsonData.name;
          } else if (jsonData.title) {
            return jsonData.title;
          } else if (jsonData.description) {
            return jsonData.description;
          }
        } catch (parseErr) {
          // 正则提取关键字段
          const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/);
          const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/);
          const descMatch = content.match(/"description"\s*:\s*"([^"]+)"/);

          if (nameMatch) return nameMatch[1];
          if (titleMatch) return titleMatch[1];
          if (descMatch) return descMatch[1];
        }
      } catch (err) {
        // JSON解析失败，继续使用内容预览
      }
    }

    // 对于其他文件，直接返回内容摘要（省略文件类型前缀）
    if (lines.length > 0) {
      const contentPreview = lines.join(' ').substring(0, 200).trim();
      if (contentPreview) {
        return contentPreview + (contentPreview.length >= 200 ? '...' : '');
      }
    }

    // 如果没有有价值的内容，返回空字符串（让AI根据文件名和后缀推断）
    return '';
  }

  /**
   * 使用 exiftool 提取文件元数据
   */
  async extractExifMetadata(filePath: string): Promise<Tags> {
    try {
      return await exiftool.read(filePath);
    } catch (err) {
      logger.debug(
        { module: 'file-metadata', file: path.basename(filePath), err },
        'EXIF元数据提取失败'
      );
      throw err;
    }
  }

  /**
   * 获取真正有价值的元数据标签字符串（排除法过滤）
   */
  getMetadataTagsString(tags: Tags): string {
    const tagsList: string[] = [];

    // 不重要的字段黑名单（排除法）
    const excludeFields = new Set([
      // 文件系统相关
      'SourceFile',
      'Directory',
      'FileName',
      'FileSize',
      'FilePermissions',
      'FileModifyDate',
      'FileAccessDate',
      'FileCreateDate',
      'CreationDate',
      'ModDate',

      // 技术细节
      'ExifToolVersion',
      'MIMEType',
      'FileType',
      'FileTypeExtension',
      'warnings',
      'errors',

      // 图像技术参数
      'ColorComponents',
      'YCbCrSubSampling',
      'EncodingProcess',
      'BitsPerSample',
      'JFIFVersion',
      'ResolutionUnit',
      'XResolution',
      'YResolution',
      'ImageSize',
      'Megapixels',

      // 程序技术细节
      'MachineType',
      'PEType',
      'LinkerVersion',
      'CodeSize',
      'InitializedDataSize',
      'UninitializedDataSize',
      'EntryPoint',
      'OSVersion',
      'ImageVersion',
      'SubsystemVersion',
      'Subsystem',
      'FileFlagsMask',
      'FileFlags',
      'FileOS',
      'ObjectFileType',
      'FileSubtype',
      'LanguageCode',
      'CharacterSet',
      'TimeStamp',
      'ImageFileCharacteristics',
      'PDBModifyDate',
      'PDBAge',
      'PDBFileName',
    ]);

    // 遍历所有标签，排除不重要的
    Object.entries(tags).forEach(([field, value]) => {
      try {
        if (!excludeFields.has(field) && value != null && value !== undefined) {
          const stringValue = value.toString().trim();
          if (stringValue && stringValue !== '0' && stringValue !== 'false') {
            tagsList.push(`${field}: ${stringValue}`);
          }
        }
      } catch {
        // 单个字段处理失败不影响其他字段
      }
    });

    return tagsList.join(', ');
  }

  /**
   * 格式化文件提示信息
   */
  formatFilePrompt(tags: string, summary: string): string {
    // 当两者都为空时，返回空字符串
    if (!tags && !summary) {
      return '';
    }
    // 否则返回格式化的字符串
    return `元数据: ${tags}\n摘要: ${summary}`;
  }

  /**
   * 获取文件描述信息（主要入口方法）
   */
  async getFileDescription(filePath: string): Promise<string> {
    const fileName = path.basename(filePath);
    const isText = this.fileReader.checkIsTextFile(filePath);

    if (isText) {
      try {
        const summary = this.generateTextFileDescription(filePath);
        if (summary && summary.trim()) {
          return this.formatFilePrompt('', summary);
        }
        return this.formatFilePrompt('', '');
      } catch (err) {
        logger.debug(
          { module: 'file-metadata', file: fileName, err },
          '文本读取失败，尝试使用 exiftool'
        );
      }
    }

    // 使用 exiftool 提取元数据
    try {
      const tags = await this.extractExifMetadata(filePath);
      const tagsString = this.getMetadataTagsString(tags);
      return this.formatFilePrompt(tagsString, '');
    } catch (err) {
      logger.debug(
        { module: 'file-metadata', file: fileName, err },
        '元数据提取失败，使用备用方法'
      );
      return this.formatFilePrompt('', '');
    }
  }

  /**
   * 获取文件类型特定的元数据
   */
  async getSpecificMetadata(filePath: string): Promise<{
    basic: ReturnType<FileMetadataService['getFileBasicInfo']>;
    exif?: Tags;
    custom?: Record<string, any>;
  }> {
    const basic = this.getFileBasicInfo(filePath);
    let exif: Tags | undefined;
    let custom: Record<string, any> = {};

    try {
      // 尝试提取EXIF数据
      exif = await this.extractExifMetadata(filePath);
    } catch {
      // EXIF数据不是所有文件都支持，忽略错误
    }

    // 根据文件类型提取特定信息
    if (basic.ext === '.json') {
      try {
        const content = this.fileReader.getFileSegment(filePath, 0, 4096);
        const jsonData = JSON.parse(content);

        // 提取JSON文件的特定字段
        if (jsonData.title) {
          custom.title = jsonData.title;
        }
        if (jsonData.name) {
          custom.name = jsonData.name;
        }
        if (jsonData.description) {
          custom.description = jsonData.description;
        }
        if (jsonData.version) {
          custom.version = jsonData.version;
        }
        if (jsonData.author) {
          custom.author = jsonData.author;
        }
        if (jsonData.created || jsonData.date) {
          custom.documentDate = jsonData.created || jsonData.date;
        }
      } catch {
        // JSON解析失败，忽略
      }
    }

    return { basic, exif, custom };
  }

  /**
   * 关闭exiftool（异步）
   */
  async cleanupExiftool() {
    try {
      await exiftool.end();
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * 关闭exiftool（同步）
   */
  cleanupExiftoolSync() {
    try {
      exiftool.end();
    } catch {
      // Ignore cleanup errors
    }
  }
}
