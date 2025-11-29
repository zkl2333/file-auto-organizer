import { randomBytes } from "node:crypto";

/**
 * 任务相关工具函数
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}