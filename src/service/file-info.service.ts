import path from "node:path";
import fs from "node:fs";
import { exiftool, Tags } from "exiftool-vendored";
import { fileInfoLogger } from "../logger.js";

// 文本文件处理内部配置（AI优化版）
export const TEXT_FILE_CONFIG = {
  MAX_PREVIEW_LINES: 3, // 减少行数，避免过多token
  MAX_PREVIEW_CHARS: 300, // 减少字符数，聚焦核心内容
  MAX_FILE_SIZE: 1024 * 1024, // 1MB
  ENCODING_FALLBACK: "latin1" as BufferEncoding,
} as const;

// 常见文本文件扩展名
const TEXT_FILE_EXTENSIONS = new Set([
  ".txt",
  ".log",
  ".md",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".ts",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".php",
  ".rb",
  ".go",
  ".rs",
  ".kt",
  ".swift",
  ".sql",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
  ".yaml",
  ".yml",
  ".ini",
  ".conf",
  ".config",
  ".properties",
  ".env",
  ".gitignore",
  ".dockerfile",
  ".csv",
  ".tsv",
  ".rtf",
  ".tex",
  ".latex",
]);

// 二进制文件特征字节
const BINARY_SIGNATURES = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46], // GIF
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x50, 0x4b, 0x03, 0x04], // ZIP
  [0x52, 0x61, 0x72, 0x21], // RAR
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0x4d, 0x5a], // PE/EXE
];

export class FileInfoService {
  constructor() {
    // 清理逻辑由进程管理器统一处理
  }

  /**
   * 检测文件是否为文本文件（纯流式读取）
   */
  private isTextFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();

    // 首先检查扩展名
    if (TEXT_FILE_EXTENSIONS.has(ext)) {
      return true;
    }

    // 流式读取前1024字节判断文件类型
    try {
      const sample = this.readFileChunk(filePath, 0, 1024);
      
      // 检查是否匹配已知的二进制文件签名
      for (const signature of BINARY_SIGNATURES) {
        if (sample.length >= signature.length) {
          let matches = true;
          for (let i = 0; i < signature.length; i++) {
            if (sample[i] !== signature[i]) {
              matches = false;
              break;
            }
          }
          if (matches) return false;
        }
      }

      // 检查是否包含过多的null字节或不可打印字符
      let nullBytes = 0;
      let nonPrintable = 0;

      for (let i = 0; i < sample.length; i++) {
        const byte = sample[i];
        if (byte === 0) {
          nullBytes++;
        } else if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) {
          nonPrintable++;
        }
      }

      // 如果null字节占比超过1%或不可打印字符占比超过30%，则认为是二进制文件
      const nullRatio = nullBytes / sample.length;
      const nonPrintableRatio = nonPrintable / sample.length;

      return nullRatio < 0.01 && nonPrintableRatio < 0.3;
    } catch (err) {
      fileInfoLogger.warn(
        { file: path.basename(filePath), error: err },
        "文本文件检测失败，假设为二进制文件"
      );
      return false;
    }
  }

  /**
   * 统一的文件块读取方法
   */
  private readFileChunk(filePath: string, offset: number, size: number): Buffer {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buffer = Buffer.alloc(size);
      const bytesRead = fs.readSync(fd, buffer, 0, size, offset);
      return buffer.subarray(0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * 流式读取文本文件的前几行内容
   */
  private readTextFileLines(
    filePath: string,
    maxLines: number = TEXT_FILE_CONFIG.MAX_PREVIEW_LINES,
    maxChars: number = TEXT_FILE_CONFIG.MAX_PREVIEW_CHARS
  ): string[] {
    const result: string[] = [];
    let totalChars = 0;
    let lineCount = 0;
    let leftover = '';
    let position = 0;
    const chunkSize = 8192;

    try {
      while (lineCount < maxLines && totalChars < maxChars) {
        const chunk = this.readFileChunk(filePath, position, chunkSize);
        if (chunk.length === 0) break; // 文件结束

        position += chunk.length;
        const text = leftover + chunk.toString('utf8');
        const lines = text.split(/\r?\n/);
        
        // 保存最后一行（可能不完整）
        leftover = lines.pop() || '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          let finalLine = trimmedLine;
          if (totalChars + trimmedLine.length > maxChars) {
            const remainingChars = maxChars - totalChars;
            if (remainingChars > 10) {
              finalLine = trimmedLine.substring(0, remainingChars) + "...";
            } else {
              break;
            }
          }
          
          result.push(finalLine);
          totalChars += finalLine.length;
          lineCount++;
          
          if (lineCount >= maxLines || totalChars >= maxChars) break;
        }
      }
      
      // 处理最后剩余的内容
      if (leftover.trim() && lineCount < maxLines && totalChars < maxChars) {
        const trimmedLine = leftover.trim();
        let finalLine = trimmedLine;
        if (totalChars + trimmedLine.length > maxChars) {
          const remainingChars = maxChars - totalChars;
          if (remainingChars > 10) {
            finalLine = trimmedLine.substring(0, remainingChars) + "...";
          }
        }
        if (finalLine) {
          result.push(finalLine);
        }
      }
      
      return result;
    } catch (err) {
      // 尝试使用其他编码
      try {
        const chunk = this.readFileChunk(filePath, 0, Math.min(maxChars * 2, 4096));
        const content = chunk.toString(TEXT_FILE_CONFIG.ENCODING_FALLBACK);
        const lines = content.split(/\r?\n/).slice(0, maxLines);
        return lines
          .filter((line) => line.trim())
          .map((line) =>
            line.length > maxChars / 5 ? line.substring(0, maxChars / 5) + "..." : line
          );
      } catch (fallbackErr) {
        fileInfoLogger.error(
          {
            file: path.basename(filePath),
            error: err,
            fallbackError: fallbackErr,
          },
          "读取文本文件内容失败"
        );
        return [];
      }
    }
  }

  /**
   * 为文本文件生成描述（AI优化版：省略已知文件类型）
   */
  private generateTextFileDescription(filePath: string): string {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // 读取文件的前几行
    const lines = this.readTextFileLines(
      filePath,
      Math.min(3, TEXT_FILE_CONFIG.MAX_PREVIEW_LINES),
      Math.min(300, TEXT_FILE_CONFIG.MAX_PREVIEW_CHARS)
    );

    // 特殊处理：JSON文件尝试提取关键信息
    if (ext === ".json") {
      try {
        const chunk = this.readFileChunk(filePath, 0, 8192);
        const content = chunk.toString('utf8');
        
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
      const contentPreview = lines.join(" ").substring(0, 200).trim();
      if (contentPreview) {
        return contentPreview + (contentPreview.length >= 200 ? "..." : "");
      }
    }

    // 如果没有有价值的内容，返回空字符串（让AI根据文件名和后缀推断）
    return "";
  }

  /**
   * 检查文件是否可以安全读取
   */
  private validateFile(filePath: string): { valid: boolean; error?: string } {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: "文件不存在" };
      }

      // 获取文件状态
      const stats = fs.statSync(filePath);

      // 检查是否为文件
      if (!stats.isFile()) {
        return { valid: false, error: "不是有效的文件" };
      }

      // 检查文件大小
      if (stats.size === 0) {
        return { valid: false, error: "文件为空" };
      }

      // 检查文件大小是否过大（超过2GB可能有问题）
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (stats.size > maxSize) {
        return { valid: false, error: `文件过大 (${(stats.size / 1024 / 1024).toFixed(2)}MB)` };
      }

      // 检查文件权限
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch {
        return { valid: false, error: "文件读取权限不足" };
      }

      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : "文件验证失败",
      };
    }
  }

  /** 根据文件类型返回相关标签 */
  private getTagsForFileType(filePath: string): string[] {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case ".exe":
        return [
          "FileDescription",
          "ProductName",
          "CompanyName",
          "ProductVersion",
          "FileVersionNumber",
          "InternalName",
          "LegalCopyright",
          "Comment",
          "Title",
          "Description",
          "Subject",
        ];
      case ".jpg":
      case ".jpeg":
      case ".png":
      case ".gif":
      case ".tiff":
        return [
          "Make",
          "Model",
          "ExposureTime",
          "FNumber",
          "ISO",
          "DateTimeOriginal",
          "GPSLatitude",
          "GPSLongitude",
        ];
      case ".mp4":
      case ".mov":
      case ".avi":
        return [
          "Make",
          "Model",
          "Software",
          "Duration",
          "VideoCodec",
          "AudioCodec",
          "DateTimeOriginal",
        ];
      case ".mp3":
      case ".wav":
        return ["Artist", "Album", "Title", "Track", "Genre", "Duration", "DateTimeOriginal"];
      case ".pdf":
        return ["Title", "Author", "Subject", "Creator", "Producer", "CreationDate", "ModDate"];
      case ".docx":
        return [
          "Title",
          "Author",
          "Subject",
          "Creator",
          "Producer",
          "CreationDate",
          "LastModifiedBy",
        ];
      default:
        return ["Title", "Description", "Subject", "Comment", "CompanyName", "ProductVersion"];
    }
  }

  /**
   * 通用函数：根据指定字段构建描述
   */
  private buildDescription(tags: Tags, fields: string[]): string | null {
    const parts: string[] = [];
    fields.forEach((field) => {
      const value = tags[field as keyof Tags];
      if (value) {
        parts.push(`${value}`);
      }
    });
    return fields.length > 0
      ? parts
          .map((part) => part.trim())
          .join(" ")
          .trim()
      : null;
  }

  /**
   * 获取任意文件描述信息（供外部调用）
   */
  async getFileDescription(filePath: string): Promise<string> {
    const fileName = path.basename(filePath);

    // 预检查文件
    const validation = this.validateFile(filePath);
    if (!validation.valid) {
      fileInfoLogger.warn(
        {
          file: fileName,
          reason: validation.error,
          fallback: true,
        },
        "文件预检查失败，使用备用方法"
      );
      return this.getFileDescriptionFallback(filePath);
    }

    // 检查是否为文本文件
    if (this.isTextFile(filePath)) {
      try {
        const description = this.generateTextFileDescription(filePath);
        fileInfoLogger.info(
          {
            file: fileName,
            description,
            type: "text",
          },
          "获取文本文件描述信息成功"
        );
        return description;
      } catch (err) {
        fileInfoLogger.error(
          {
            file: fileName,
            error: err,
          },
          "读取文本文件失败，尝试使用exiftool"
        );
        // 继续使用exiftool处理
      }
    }

    try {
      const tags = await exiftool.read(filePath);
      const fileTags = this.getTagsForFileType(filePath);
      const description = this.buildDescription(tags, fileTags) ?? "";

      if (description) {
        fileInfoLogger.info(
          {
            file: fileName,
            description,
            type: "metadata",
          },
          "获取文件描述信息成功"
        );
      } else {
        fileInfoLogger.info({ file: fileName }, "文件无可用描述信息");
      }

      return description || this.getFileDescriptionFallback(filePath);
    } catch (err) {
      // 提供详细的错误信息
      const errorInfo = {
        file: fileName,
        filePath,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorName: err instanceof Error ? err.name : "Unknown",
        errorStack: err instanceof Error ? err.stack : undefined,
      };

      // 根据错误类型提供不同的处理建议
      let errorCategory = "未知错误";
      const errorMessage = errorInfo.errorMessage.toLowerCase();

      if (errorMessage.includes("permission") || errorMessage.includes("access")) {
        errorCategory = "权限错误";
      } else if (errorMessage.includes("file not found") || errorMessage.includes("enoent")) {
        errorCategory = "文件不存在";
      } else if (errorMessage.includes("busy") || errorMessage.includes("lock")) {
        errorCategory = "文件被占用";
      } else if (errorMessage.includes("unsupported") || errorMessage.includes("format")) {
        errorCategory = "不支持的文件格式";
      } else if (errorMessage.includes("timeout")) {
        errorCategory = "读取超时";
      }

      fileInfoLogger.error({ ...errorInfo, category: errorCategory }, "读取文件信息失败");

      // 尝试备用方法：基于文件名和扩展名生成基础描述
      return this.getFileDescriptionFallback(filePath);
    }
  }

  /**
   * 备用文件描述获取方法（极简版：完全依赖AI推断）
   */
  private getFileDescriptionFallback(filePath: string): string {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // AI已知的常见文件类型完全不需要额外描述
    const knownExtensions = new Set([
      ".exe", ".msi", ".dmg", ".deb", ".rpm",
      ".zip", ".rar", ".7z", ".tar", ".gz",
      ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
      ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp",
      ".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm",
      ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac",
      ".txt", ".md", ".json", ".xml", ".yaml", ".yml", ".ini", ".conf",
      ".js", ".ts", ".py", ".java", ".cpp", ".cs", ".php", ".rb", ".go",
      ".html", ".css", ".scss", ".less", ".vue", ".jsx", ".tsx"
    ]);

    if (knownExtensions.has(ext)) {
      fileInfoLogger.debug(
        { file: fileName },
        "已知文件类型，返回空描述让AI推断"
      );
      return "";
    }

    // 对于真正未知的文件类型，也返回空描述，让AI根据完整文件名判断
    fileInfoLogger.debug(
      { file: fileName, unknownExt: ext },
      "未知文件类型，返回空描述让AI推断"
    );
    
    return "";
  }

  /**
   * 公共方法：检查文件是否为文本文件
   */
  public checkIsTextFile(filePath: string): boolean {
    return this.isTextFile(filePath);
  }

  /**
   * 公共方法：读取文本文件的前几行
   */
  public getTextFilePreview(
    filePath: string,
    maxLines: number = TEXT_FILE_CONFIG.MAX_PREVIEW_LINES,
    maxChars: number = TEXT_FILE_CONFIG.MAX_PREVIEW_CHARS
  ): string[] {
    if (!this.isTextFile(filePath)) {
      throw new Error("指定文件不是文本文件");
    }
    return this.readTextFileLines(filePath, maxLines, maxChars);
  }

  /**
   * 公共方法：流式读取文本文件的完整内容
   */
  public getTextFileContent(
    filePath: string,
    maxSize: number = TEXT_FILE_CONFIG.MAX_FILE_SIZE
  ): string {
    if (!this.isTextFile(filePath)) {
      throw new Error("指定文件不是文本文件");
    }

    try {
      const stats = fs.statSync(filePath);
      if (stats.size > maxSize) {
        throw new Error(`文件过大，最大支持 ${(maxSize / 1024).toFixed(0)}KB`);
      }

      // 统一使用流式读取
      const chunk = this.readFileChunk(filePath, 0, stats.size);
      return chunk.toString('utf8');
    } catch (err) {
      if (err instanceof Error && err.message.includes("文件过大")) {
        throw err;
      }

      // 尝试其他编码
      try {
        const stats = fs.statSync(filePath);
        const chunk = this.readFileChunk(filePath, 0, Math.min(stats.size, maxSize));
        return chunk.toString(TEXT_FILE_CONFIG.ENCODING_FALLBACK);
      } catch (fallbackErr) {
        throw new Error(`读取文件失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * 公共方法：流式读取文件内容（支持回调处理每个块）
   */
  public readFileStream(
    filePath: string,
    chunkProcessor: (chunk: string, isLast: boolean) => boolean, // 返回false停止读取
    options: {
      encoding?: BufferEncoding;
      chunkSize?: number;
      maxSize?: number;
    } = {}
  ): { totalBytesRead: number; stopped: boolean } {
    if (!this.isTextFile(filePath)) {
      throw new Error("指定文件不是文本文件");
    }

    const {
      encoding = 'utf8',
      chunkSize = 8192,
      maxSize = 100 * 1024 * 1024
    } = options;

    const stats = fs.statSync(filePath);
    const fileSize = Math.min(stats.size, maxSize);
    
    let totalBytesRead = 0;
    let stopped = false;
    let leftover = '';
    
    try {
      while (totalBytesRead < fileSize && !stopped) {
        const remainingBytes = fileSize - totalBytesRead;
        const currentChunkSize = Math.min(chunkSize, remainingBytes);
        
        const buffer = this.readFileChunk(filePath, totalBytesRead, currentChunkSize);
        if (buffer.length === 0) break;
        
        totalBytesRead += buffer.length;
        const chunk = leftover + buffer.toString(encoding);
        
        const isLast = totalBytesRead >= fileSize;
        
        if (isLast) {
          if (!chunkProcessor(chunk, true)) {
            stopped = true;
          }
        } else {
          const lines = chunk.split(/\r?\n/);
          leftover = lines.pop() || '';
          const processChunk = lines.join('\n');
          
          if (processChunk && !chunkProcessor(processChunk, false)) {
            stopped = true;
          }
        }
      }
    } catch (err) {
      throw new Error(`流式读取文件失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    return { totalBytesRead, stopped };
  }

  /**
   * 公共方法：获取文件指定部分内容
   */
  public getFileSegment(
    filePath: string,
    startByte: number = 0,
    maxBytes: number = 1024 * 1024,
    encoding: BufferEncoding = 'utf8'
  ): string {
    if (!this.isTextFile(filePath)) {
      throw new Error("指定文件不是文本文件");
    }

    try {
      const stats = fs.statSync(filePath);
      const actualStartByte = Math.min(startByte, stats.size);
      const actualMaxBytes = Math.min(maxBytes, stats.size - actualStartByte);
      
      if (actualMaxBytes <= 0) {
        return '';
      }
      
      const chunk = this.readFileChunk(filePath, actualStartByte, actualMaxBytes);
      return chunk.toString(encoding);
    } catch (err) {
      // 尝试其他编码
      try {
        const chunk = this.readFileChunk(filePath, startByte, Math.min(maxBytes, 4096));
        return chunk.toString(TEXT_FILE_CONFIG.ENCODING_FALLBACK);
      } catch (fallbackErr) {
        throw new Error(`读取文件段失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * 公共方法：获取文件基本信息
   */
  public getFileBasicInfo(filePath: string): {
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
      isText: this.isTextFile(filePath),
      modified: stats.mtime,
      created: stats.birthtime || stats.ctime,
    };
  }

  /**
   * 程序退出时关闭 exiftool (异步)
   */
  public async cleanupExiftool() {
    try {
      await exiftool.end();
    } catch (err) {
      fileInfoLogger.error({ error: err }, "关闭 exiftool 失败");
    }
  }

  /**
   * 程序退出时关闭 exiftool (同步)
   */
  public cleanupExiftoolSync() {
    try {
      exiftool.end(); // sync 关闭，保证进程退出
    } catch (err) {
      fileInfoLogger.error({ error: err }, "同步关闭 exiftool 失败");
    }
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
