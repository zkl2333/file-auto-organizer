import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';
import { exiftool, Tags } from 'exiftool-vendored';

// File type categories
const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.tiff',
  '.webp',
  '.heic',
  '.heif',
  '.raw',
  '.cr2',
  '.nef',
  '.arw',
];
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.avi',
  '.mov',
  '.mkv',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
  '.mpeg',
  '.mpg',
  '.3gp',
];
const AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
  '.ogg',
  '.wma',
  '.m4a',
  '.opus',
  '.aiff',
];
const DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
];
const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'];
const EXECUTABLE_EXTENSIONS = ['.exe', '.msi', '.apk', '.dmg', '.app', '.deb', '.rpm'];

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
      const parts: string[] = [];

      // Basic file size
      parts.push(this.formatFileSize(stats.size));

      // Type-specific metadata extraction
      if (IMAGE_EXTENSIONS.includes(ext)) {
        const imageInfo = await this.getImageInfo(filePath);
        if (imageInfo) parts.push(imageInfo);
      } else if (VIDEO_EXTENSIONS.includes(ext)) {
        const videoInfo = await this.getVideoInfo(filePath);
        if (videoInfo) parts.push(videoInfo);
      } else if (AUDIO_EXTENSIONS.includes(ext)) {
        const audioInfo = await this.getAudioInfo(filePath);
        if (audioInfo) parts.push(audioInfo);
      } else if (DOCUMENT_EXTENSIONS.includes(ext)) {
        const docInfo = await this.getDocumentInfo(filePath, ext);
        if (docInfo) parts.push(docInfo);
      } else if (EXECUTABLE_EXTENSIONS.includes(ext)) {
        const execInfo = await this.getExecutableInfo(filePath, ext);
        if (execInfo) parts.push(execInfo);
      } else if (ARCHIVE_EXTENSIONS.includes(ext)) {
        parts.push('压缩文件');
      } else if (this.isTextFile(ext)) {
        const textInfo = this.getTextFilePreview(filePath);
        if (textInfo) parts.push(textInfo);
      }

      return parts.join(', ');
    } catch (error) {
      logger.error({ module: 'file-info', filePath, error }, '获取文件描述失败');
      return '';
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }

  /**
   * 格式化时长
   */
  private formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * 获取图片信息
   */
  private async getImageInfo(filePath: string): Promise<string | null> {
    try {
      const metadata = await exiftool.read(filePath);
      const infoParts: string[] = [];

      // Dimensions
      const width = metadata.ImageWidth || metadata.ExifImageWidth;
      const height = metadata.ImageHeight || metadata.ExifImageHeight;
      if (width && height) {
        infoParts.push(`${width}x${height}`);
      }

      // Camera info
      if (metadata.Make || metadata.Model) {
        const camera = [metadata.Make, metadata.Model].filter(Boolean).join(' ');
        if (camera) infoParts.push(`相机: ${camera}`);
      }

      // Date taken
      if (metadata.DateTimeOriginal) {
        infoParts.push(`拍摄: ${String(metadata.DateTimeOriginal).split(' ')[0]}`);
      }

      // GPS location
      if (metadata.GPSLatitude && metadata.GPSLongitude) {
        infoParts.push('含GPS');
      }

      // Color profile
      if (metadata.ColorSpace || metadata.ProfileDescription) {
        const colorInfo = metadata.ProfileDescription || metadata.ColorSpace;
        if (colorInfo && String(colorInfo).length < 20) {
          infoParts.push(String(colorInfo));
        }
      }

      return infoParts.length > 0 ? infoParts.join(', ') : null;
    } catch (error) {
      logger.debug({ module: 'file-info', filePath, error }, 'EXIF读取失败');
      return null;
    }
  }

  /**
   * 获取视频信息
   */
  private async getVideoInfo(filePath: string): Promise<string | null> {
    try {
      const metadata = await exiftool.read(filePath);
      const infoParts: string[] = [];

      // Duration
      const duration = this.extractDuration(metadata);
      if (duration) {
        infoParts.push(`时长: ${this.formatDuration(duration)}`);
      }

      // Resolution
      const width = metadata.ImageWidth || (metadata as Record<string, unknown>).VideoWidth;
      const height = metadata.ImageHeight || (metadata as Record<string, unknown>).VideoHeight;
      if (width && height) {
        infoParts.push(`${width}x${height}`);
        // Add quality label
        const h = Number(height);
        if (h >= 2160) infoParts.push('4K');
        else if (h >= 1080) infoParts.push('1080p');
        else if (h >= 720) infoParts.push('720p');
      }

      // Frame rate
      const frameRate = (metadata as Record<string, unknown>).VideoFrameRate || metadata.FrameRate;
      if (frameRate) {
        infoParts.push(`${Math.round(Number(frameRate))}fps`);
      }

      // Codec
      const codec =
        (metadata as Record<string, unknown>).CompressorID ||
        (metadata as Record<string, unknown>).VideoCodec ||
        metadata.FileType;
      if (codec && String(codec).length < 15) {
        infoParts.push(String(codec));
      }

      // Audio channels
      const audioChannels = (metadata as Record<string, unknown>).AudioChannels;
      if (audioChannels) {
        infoParts.push(Number(audioChannels) > 2 ? '环绕声' : '立体声');
      }

      return infoParts.length > 0 ? infoParts.join(', ') : null;
    } catch (error) {
      logger.debug({ module: 'file-info', filePath, error }, '视频元数据读取失败');
      return null;
    }
  }

  /**
   * 获取音频信息
   */
  private async getAudioInfo(filePath: string): Promise<string | null> {
    try {
      const metadata = await exiftool.read(filePath);
      const infoParts: string[] = [];

      // Duration
      const duration = this.extractDuration(metadata);
      if (duration) {
        infoParts.push(`时长: ${this.formatDuration(duration)}`);
      }

      // Artist & Album
      const artist =
        (metadata as Record<string, unknown>).Artist ||
        (metadata as Record<string, unknown>).AlbumArtist;
      const album = (metadata as Record<string, unknown>).Album;
      const title = (metadata as Record<string, unknown>).Title;

      if (title) infoParts.push(`曲名: ${String(title).substring(0, 30)}`);
      if (artist) infoParts.push(`艺人: ${String(artist).substring(0, 20)}`);
      if (album) infoParts.push(`专辑: ${String(album).substring(0, 20)}`);

      // Bitrate
      const bitrate =
        (metadata as Record<string, unknown>).AudioBitrate ||
        (metadata as Record<string, unknown>).AvgBitrate;
      if (bitrate) {
        const kbps = Math.round(Number(String(bitrate).replace(/[^\d]/g, '')) / 1000);
        if (kbps > 0 && kbps < 10000) infoParts.push(`${kbps}kbps`);
      }

      // Sample rate
      const sampleRate =
        (metadata as Record<string, unknown>).SampleRate ||
        (metadata as Record<string, unknown>).AudioSampleRate;
      if (sampleRate) {
        const khz = Math.round(Number(sampleRate) / 1000);
        if (khz > 0) infoParts.push(`${khz}kHz`);
      }

      return infoParts.length > 0 ? infoParts.join(', ') : null;
    } catch (error) {
      logger.debug({ module: 'file-info', filePath, error }, '音频元数据读取失败');
      return null;
    }
  }

  /**
   * 获取文档信息
   */
  private async getDocumentInfo(filePath: string, ext: string): Promise<string | null> {
    try {
      const metadata = await exiftool.read(filePath);
      const infoParts: string[] = [];

      // Page count (PDF)
      const pageCount =
        (metadata as Record<string, unknown>).PageCount ||
        (metadata as Record<string, unknown>).Pages;
      if (pageCount) {
        infoParts.push(`${pageCount}页`);
      }

      // Title
      const title = metadata.Title || (metadata as Record<string, unknown>).Subject;
      if (title && String(title).length > 2) {
        infoParts.push(`标题: ${String(title).substring(0, 40)}`);
      }

      // Author
      const author =
        metadata.Author || metadata.Creator || (metadata as Record<string, unknown>).LastModifiedBy;
      if (author) {
        infoParts.push(`作者: ${String(author).substring(0, 20)}`);
      }

      // Creation date
      if (metadata.CreateDate) {
        infoParts.push(`创建: ${String(metadata.CreateDate).split(' ')[0]}`);
      }

      // PDF specific
      if (ext === '.pdf') {
        const pdfVersion = (metadata as Record<string, unknown>).PDFVersion;
        if (pdfVersion) infoParts.push(`PDF ${pdfVersion}`);

        const encrypted = (metadata as Record<string, unknown>).Encryption;
        if (encrypted) infoParts.push('加密');
      }

      // Word count (if available)
      const wordCount = (metadata as Record<string, unknown>).WordCount;
      if (wordCount) {
        infoParts.push(`${wordCount}字`);
      }

      return infoParts.length > 0 ? infoParts.join(', ') : null;
    } catch (error) {
      logger.debug({ module: 'file-info', filePath, error }, '文档元数据读取失败');
      return null;
    }
  }

  /**
   * 获取可执行文件信息
   */
  private async getExecutableInfo(filePath: string, ext: string): Promise<string | null> {
    try {
      const metadata = await exiftool.read(filePath);
      const infoParts: string[] = [];

      if (ext === '.apk') {
        // APK specific info
        const appName =
          (metadata as Record<string, unknown>).ApplicationName ||
          (metadata as Record<string, unknown>).ApplicationLabel;
        const version =
          (metadata as Record<string, unknown>).AndroidVersionName ||
          (metadata as Record<string, unknown>).AndroidVersion;
        const packageName = (metadata as Record<string, unknown>).AndroidPackageName;
        const minSdk = (metadata as Record<string, unknown>).AndroidMinSDKVersion;

        if (appName) infoParts.push(`应用: ${String(appName).substring(0, 30)}`);
        if (version) infoParts.push(`版本: ${version}`);
        if (packageName) infoParts.push(`包名: ${String(packageName).substring(0, 40)}`);
        if (minSdk) infoParts.push(`minSDK: ${minSdk}`);
      } else if (ext === '.exe' || ext === '.msi') {
        // Windows executable info
        const productName = (metadata as Record<string, unknown>).ProductName;
        const productVersion =
          (metadata as Record<string, unknown>).ProductVersion ||
          (metadata as Record<string, unknown>).FileVersion;
        const company = (metadata as Record<string, unknown>).CompanyName;

        if (productName) infoParts.push(`产品: ${String(productName).substring(0, 30)}`);
        if (productVersion) infoParts.push(`版本: ${productVersion}`);
        if (company) infoParts.push(`厂商: ${String(company).substring(0, 20)}`);
      } else if (ext === '.dmg' || ext === '.app') {
        // macOS app info
        const appName = (metadata as Record<string, unknown>).CFBundleName;
        const version = (metadata as Record<string, unknown>).CFBundleShortVersionString;
        if (appName) infoParts.push(`应用: ${appName}`);
        if (version) infoParts.push(`版本: ${version}`);
      }

      return infoParts.length > 0 ? infoParts.join(', ') : null;
    } catch (error) {
      logger.debug({ module: 'file-info', filePath, error }, '可执行文件元数据读取失败');
      return null;
    }
  }

  /**
   * 获取文本文件预览
   */
  private getTextFilePreview(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath, { encoding: 'utf8' });
      const lines = content.split('\n').slice(0, 5);
      const preview = lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(' ')
        .substring(0, 200);

      if (preview) {
        return `预览: ${preview}${content.length > 200 ? '...' : ''}`;
      }
      return null;
    } catch (error) {
      logger.debug({ module: 'file-info', filePath, error }, '文本文件读取失败');
      return null;
    }
  }

  /**
   * 提取时长（秒）
   */
  private extractDuration(metadata: Tags): number | null {
    const durationField =
      metadata.Duration ||
      (metadata as Record<string, unknown>).MediaDuration ||
      (metadata as Record<string, unknown>).TrackDuration;

    if (!durationField) return null;

    const durationStr = String(durationField);

    // Handle "HH:MM:SS" format
    if (durationStr.includes(':')) {
      const parts = durationStr.split(':').map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }

    // Handle "X.XX s" format
    const match = durationStr.match(/([\d.]+)\s*s/i);
    if (match) return parseFloat(match[1]);

    // Handle pure number (assume seconds)
    const num = parseFloat(durationStr);
    if (!isNaN(num)) return num;

    return null;
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
