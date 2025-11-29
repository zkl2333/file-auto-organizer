import { randomBytes } from 'node:crypto';

/**
 * 任务相关工具函数 - Next.js 适配版本
 */
export class TaskUtils {
  /**
   * 生成任务ID
   */
  static generateTaskId(): string {
    const ts = Date.now().toString(36);
    const rand = randomBytes(2).toString('hex');
    return `task-${ts}-${rand}`;
  }

  /**
   * 格式化时间戳
   */
  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * 格式化持续时间
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = Math.floor((milliseconds % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * 验证任务ID格式
   */
  static isValidTaskId(taskId: string): boolean {
    return /^task-[a-z0-9]+-[a-f0-9]{4}$/i.test(taskId);
  }

  /**
   * 计算任务进度百分比
   */
  static calculateProgress(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  /**
   * 延迟执行
   */
  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * 获取文件扩展名
   */
  static getFileExtension(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    return ext ? `.${ext}` : '';
  }

  /**
   * 判断是否为常见图片格式
   */
  static isImageFile(fileName: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico'];
    const ext = this.getFileExtension(fileName);
    return imageExtensions.includes(ext);
  }

  /**
   * 判断是否为常见文档格式
   */
  static isDocumentFile(fileName: string): boolean {
    const docExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'];
    const ext = this.getFileExtension(fileName);
    return docExtensions.includes(ext);
  }

  /**
   * 判断是否为常见视频格式
   */
  static isVideoFile(fileName: string): boolean {
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];
    const ext = this.getFileExtension(fileName);
    return videoExtensions.includes(ext);
  }

  /**
   * 判断是否为常见音频格式
   */
  static isAudioFile(fileName: string): boolean {
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
    const ext = this.getFileExtension(fileName);
    return audioExtensions.includes(ext);
  }

  /**
   * 安全地解析 JSON
   */
  static safeJsonParse<T>(json: string, defaultValue: T): T {
    try {
      return JSON.parse(json);
    } catch {
      return defaultValue;
    }
  }

  /**
   * 生成随机颜色（用于文件类型标识等）
   */
  static generateRandomColor(): string {
    const colors = [
      '#ef4444',
      '#f97316',
      '#f59e0b',
      '#eab308',
      '#84cc16',
      '#22c55e',
      '#10b981',
      '#14b8a6',
      '#06b6d4',
      '#0ea5e9',
      '#3b82f6',
      '#6366f1',
      '#8b5cf6',
      '#a855f7',
      '#d946ef',
      '#ec4899',
      '#f43f5e',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
