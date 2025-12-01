import path from 'node:path';
import fs from 'node:fs';
import { logger } from '@/lib/logger';
import type { ProcessedFile } from '@/lib/api-client';

/**
 * 文件状态管理服务 - Next.js 适配版本
 */
export class FileStatusService {
  private tasksDir: string;

  constructor() {
    this.tasksDir = path.join(process.cwd(), 'data', 'tasks');
    this.ensureTasksDir();
  }

  /**
   * 确保 tasks 目录存在
   */
  private ensureTasksDir(): void {
    if (!fs.existsSync(this.tasksDir)) {
      fs.mkdirSync(this.tasksDir, { recursive: true });
      logger.info({ tasksDir: this.tasksDir }, '创建 tasks 目录');
    }
  }

  /**
   * 保存文件列表到任务目录
   */
  async saveFileList(taskId: string, processedFiles: ProcessedFile[]): Promise<void> {
    try {
      const taskDir = path.join(this.tasksDir, taskId);
      if (!fs.existsSync(taskDir)) {
        fs.mkdirSync(taskDir, { recursive: true });
      }

      const fileListPath = path.join(taskDir, 'files.json');
      fs.writeFileSync(fileListPath, JSON.stringify(processedFiles, null, 2), 'utf8');

      logger.info({ taskId, fileCount: processedFiles.length }, '文件列表已保存到任务目录');
    } catch (error) {
      logger.error({ error, taskId }, '保存文件列表失败');
    }
  }

  /**
   * 获取指定任务的文件列表
   */
  async getTaskFiles(taskId: string): Promise<ProcessedFile[]> {
    try {
      const taskDir = path.join(this.tasksDir, taskId);
      const fileListPath = path.join(taskDir, 'files.json');

      if (!fs.existsSync(fileListPath)) {
        logger.warn({ taskId }, '任务文件列表不存在');
        return [];
      }

      const fileContent = fs.readFileSync(fileListPath, 'utf8');
      const files: ProcessedFile[] = JSON.parse(fileContent);

      logger.info({ taskId, fileCount: files.length }, '已加载任务文件列表');
      return files;
    } catch (error) {
      logger.error({ error, taskId }, '加载任务文件列表失败');
      return [];
    }
  }

  /**
   * 更新单个文件状态并保存到磁盘
   */
  async updateAndSaveFileStatus(
    taskId: string,
    processedFiles: ProcessedFile[],
    fileName: string,
    updates: Partial<ProcessedFile>
  ): Promise<void> {
    // 更新内存中的状态
    this.updateProcessedFileStatus(processedFiles, fileName, updates);

    // 保存到磁盘
    await this.saveFileList(taskId, processedFiles);
  }

  /**
   * 批量更新文件状态并保存
   */
  async batchUpdateAndSaveFileStatus(
    taskId: string,
    processedFiles: ProcessedFile[],
    updates: Array<{ fileName: string; updates: Partial<ProcessedFile> }>
  ): Promise<void> {
    // 批量更新内存中的状态
    for (const { fileName, updates: fileUpdates } of updates) {
      this.updateProcessedFileStatus(processedFiles, fileName, fileUpdates);
    }

    // 保存到磁盘
    await this.saveFileList(taskId, processedFiles);
  }

  /**
   * 更新已处理文件的状态（内存中）
   */
  private updateProcessedFileStatus(
    processedFiles: ProcessedFile[],
    fileName: string,
    updates: Partial<ProcessedFile>
  ): void {
    const file = processedFiles.find((pf) => pf.name === fileName);
    if (file) {
      Object.assign(file, updates);
      file.timestamp = Date.now();
    }
  }

  /**
   * 获取所有任务ID列表
   */
  getAllTaskIds(): string[] {
    try {
      if (!fs.existsSync(this.tasksDir)) {
        return [];
      }

      const entries = fs.readdirSync(this.tasksDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a)); // 按时间倒序
    } catch (error) {
      logger.error({ error }, '获取任务ID列表失败');
      return [];
    }
  }

  /**
   * 检查任务是否存在
   */
  taskExists(taskId: string): boolean {
    const taskDir = path.join(this.tasksDir, taskId);
    return fs.existsSync(taskDir);
  }

  /**
   * 删除任务及其所有相关文件
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const taskDir = path.join(this.tasksDir, taskId);

      if (!fs.existsSync(taskDir)) {
        logger.warn({ taskId }, '任务目录不存在，无需删除');
        return;
      }

      // 递归删除任务目录
      fs.rmSync(taskDir, { recursive: true, force: true });

      logger.info({ taskId }, '任务文件状态已删除');
    } catch (error) {
      logger.error({ error, taskId }, '删除任务文件状态失败');
      throw error;
    }
  }
}
