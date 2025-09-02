import path from "node:path";
import fs from "node:fs";
import { exiftool, Tags } from "exiftool-vendored";
import { fileInfoLogger } from "../logger.js";

export class FileInfoService {
  constructor() {
    // 清理逻辑由进程管理器统一处理
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

    try {
      const tags = await exiftool.read(filePath);
      const fileTags = this.getTagsForFileType(filePath);
      const description = this.buildDescription(tags, fileTags) ?? "";

      if (description) {
        fileInfoLogger.info({ file: fileName, description }, "获取文件描述信息成功");
      } else {
        fileInfoLogger.info({ file: fileName }, "文件无可用描述信息");
      }

      return description;
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
   * 备用文件描述获取方法
   */
  private getFileDescriptionFallback(filePath: string): string {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath, ext);

    // 基于文件扩展名和文件名模式生成描述
    const patterns = [
      { pattern: /installer|setup|install/i, type: "安装程序" },
      { pattern: /patch|update|upgrade/i, type: "更新补丁" },
      { pattern: /crack|keygen|activator/i, type: "激活工具" },
      { pattern: /driver|驱动/i, type: "驱动程序" },
      { pattern: /tool|util|工具/i, type: "工具软件" },
      { pattern: /game|游戏/i, type: "游戏软件" },
      { pattern: /media|player|播放/i, type: "媒体播放器" },
      { pattern: /browser|浏览/i, type: "浏览器" },
      { pattern: /office|word|excel|powerpoint/i, type: "办公软件" },
    ];

    let description = baseName;

    // 尝试匹配文件名模式
    for (const { pattern, type } of patterns) {
      if (pattern.test(fileName)) {
        description = `${type} ${baseName}`;
        break;
      }
    }

    // 添加文件类型信息
    const fileTypeMap: Record<string, string> = {
      ".exe": "可执行文件",
      ".msi": "Windows安装包",
      ".dmg": "Mac磁盘映像",
      ".deb": "Debian安装包",
      ".rpm": "RPM安装包",
      ".zip": "压缩文件",
      ".rar": "压缩文件",
      ".7z": "压缩文件",
      ".pdf": "PDF文档",
      ".doc": "Word文档",
      ".docx": "Word文档",
      ".xls": "Excel表格",
      ".xlsx": "Excel表格",
      ".ppt": "PowerPoint演示",
      ".pptx": "PowerPoint演示",
    };

    const fileType = fileTypeMap[ext];
    if (fileType && !description.includes(fileType)) {
      description = `${description} (${fileType})`;
    }

    fileInfoLogger.info({ file: fileName, fallbackDescription: description }, "使用备用方法生成文件描述");

    return description;
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

