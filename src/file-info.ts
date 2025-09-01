import path from "node:path";
import { exiftool, Tags } from "exiftool-vendored";
import { logger } from "./logger.js";

/** 根据文件类型返回相关标签 */
function getTagsForFileType(filePath: string): string[] {
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
      return [
        "Artist",
        "Album",
        "Title",
        "Track",
        "Genre",
        "Duration",
        "DateTimeOriginal",
      ];
    case ".pdf":
      return [
        "Title",
        "Author",
        "Subject",
        "Creator",
        "Producer",
        "CreationDate",
        "ModDate",
      ];
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
      return [
        "Title",
        "Description",
        "Subject",
        "Comment",
        "CompanyName",
        "ProductVersion",
      ];
  }
}

/**
 * 通用函数：根据指定字段构建描述
 */
function buildDescription(tags: Tags, fields: string[]): string | null {
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
export async function getFileDescription(filePath: string): Promise<string> {
  const fileName = path.basename(filePath);

  try {
    const tags = await exiftool.read(filePath);
    const fileTags = getTagsForFileType(filePath);
    const description = buildDescription(tags, fileTags) ?? "";

    if (description) {
      logger.info({ file: fileName, description }, "获取文件描述信息成功");
    } else {
      logger.info({ file: fileName }, "文件无可用描述信息");
    }

    return description;
  } catch (err) {
    logger.error({ file: fileName, error: err }, "读取文件信息失败");
    return "";
  }
}

/**
 * 获取文件完整元数据
 */
export async function getFileMetadata(filePath: string): Promise<Tags | null> {
  try {
    const tags = await exiftool.read(filePath);
    logger.info({ file: path.basename(filePath) }, "成功获取文件元数据");
    return tags;
  } catch (err) {
    logger.error(
      { file: path.basename(filePath), error: err },
      "获取文件元数据失败"
    );
    return null;
  }
}

/**
 * 程序退出时关闭 exiftool
 */
async function cleanupExiftool() {
  try {
    await exiftool.end();
  } catch (err) {
    logger.error({ error: err }, "关闭 exiftool 失败");
  }
}

process.on("SIGINT", async () => {
  await cleanupExiftool();
  process.exit();
});

process.on("SIGTERM", async () => {
  await cleanupExiftool();
  process.exit();
});

process.on("exit", () => {
  exiftool.end(); // sync 关闭，保证进程退出
});
