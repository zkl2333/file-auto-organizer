import React from "react";
import {
  File,
  Image,
  Video,
  Music,
  FileCode,
  Archive,
  FileJson,
  FileSpreadsheet,
  Presentation,
  FileText,
  FileType,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// 文件类型图标映射表（在组件外部定义）
const FILE_ICON_MAP: Record<string, LucideIcon> = {
  // 图片类型
  jpg: Image,
  jpeg: Image,
  png: Image,
  gif: Image,
  bmp: Image,
  webp: Image,
  svg: Image,
  ico: Image,
  heic: Image,
  heif: Image,
  // 视频类型
  mp4: Video,
  avi: Video,
  mov: Video,
  wmv: Video,
  flv: Video,
  webm: Video,
  mkv: Video,
  m4v: Video,
  "3gp": Video,
  // 音频类型
  mp3: Music,
  wav: Music,
  flac: Music,
  aac: Music,
  ogg: Music,
  wma: Music,
  m4a: Music,
  opus: Music,
  // 代码文件
  js: FileCode,
  ts: FileCode,
  jsx: FileCode,
  tsx: FileCode,
  py: FileCode,
  java: FileCode,
  cpp: FileCode,
  c: FileCode,
  cs: FileCode,
  php: FileCode,
  rb: FileCode,
  go: FileCode,
  rs: FileCode,
  swift: FileCode,
  kt: FileCode,
  dart: FileCode,
  vue: FileCode,
  svelte: FileCode,
  // 配置文件
  json: FileJson,
  yaml: FileJson,
  yml: FileJson,
  toml: FileJson,
  ini: FileJson,
  conf: FileJson,
  config: FileJson,
  // 压缩文件
  zip: Archive,
  rar: Archive,
  "7z": Archive,
  tar: Archive,
  gz: Archive,
  bz2: Archive,
  xz: Archive,
  "tar.gz": Archive,
  "tar.bz2": Archive,
  // 表格文件
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  ods: FileSpreadsheet,
  // 演示文稿
  ppt: Presentation,
  pptx: Presentation,
  odp: Presentation,
  // 文档文件
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  odt: FileText,
  rtf: FileText,
  txt: FileText,
  md: FileText,
  markdown: FileText,
  // 字体文件
  ttf: FileType,
  otf: FileType,
  woff: FileType,
  woff2: FileType,
  eot: FileType,
};

// 文件类型图标映射函数
const getFileIconType = (extension: string | undefined): LucideIcon => {
  if (!extension) return File;
  const ext = extension.toLowerCase().replace(/^\./, "");
  return FILE_ICON_MAP[ext] || File;
};

export interface FileIconProps {
  /** 文件扩展名（带或不带点都可以） */
  extension?: string;
  /** 图标大小，默认 w-4 h-4，可以是 Tailwind 类名或数字（像素值） */
  size?: string | number;
  /** 自定义 className */
  className?: string;
}

/**
 * 文件图标组件
 * 根据文件扩展名自动显示对应的图标
 */
export const FileIcon: React.FC<FileIconProps> = ({
  extension,
  size = "w-4 h-4",
  className,
}) => {
  const IconComponent = getFileIconType(extension);

  const props =
    typeof size === "number"
      ? {
          className: cn(className),
          style: { width: `${size}px`, height: `${size}px` },
        }
      : {
          className: cn(size, className),
        };

  return React.createElement(IconComponent, props);
};
