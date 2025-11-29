import path from "node:path";
import fs from "node:fs";
import { mainLogger } from "../logger.js";
import { config } from "../config.js";

// 文件处理状态类型
export type FileProcessStatus =
  | 'pending'              // 待处理（扫描完成）
  | 'similarity_matching'  // 相似度匹配中
  | 'similarity_matched'   // 相似度匹配完成
  | 'ai_classifying'       // AI分类中
  | 'ai_classified'        // AI分类完成
  | 'moving'               // 移动中
  | 'success'              // 处理成功
  | 'failed'               // 处理失败
  | 'skipped';             // 跳过

// 文件处理阶段
export type FileProcessStage = 'scan' | 'similarity' | 'ai' | 'move' | 'complete';

// 文件处理结果接口
export interface ProcessedFile {
  name: string;
  originalPath: string;
  targetPath?: string;
  type: string;
  size: string;
  status: FileProcessStatus;
  error?: string;
  method?: 'similarity' | 'ai' | 'manual';
  score?: number;
  reasoning?: string;  // AI分类原因
  timestamp: number;
  processStage?: FileProcessStage;  // 当前处理阶段
  progress?: number;  // 处理进度 0-100
}

// 文件状态更新接口
export interface FileStatusUpdate {
  fileName: string;
  updates: Partial<ProcessedFile>;
}

/**
 * 文件状态管理服务
 */
export class FileStatusService {
  /**
   * 更新已处理文件的状态（内存中）
   */
  updateProcessedFileStatus(
    processedFiles: ProcessedFile[],
    fileName: string,
    updates: Partial<ProcessedFile>
  ): void {
    const file = processedFiles.find(pf => pf.name === fileName);
    if (file) {
      Object.assign(file, updates);
      file.timestamp = Date.now();
    }
  }

  /**
   * 保存文件列表到任务目录
   */
  async saveFileList(taskId: string, processedFiles: ProcessedFile[]): Promise<void> {
    try {
      const taskDir = path.join(config.LOG_DIR, "tasks", taskId);
      if (!fs.existsSync(taskDir)) {
        fs.mkdirSync(taskDir, { recursive: true });
      }

      const fileListPath = path.join(taskDir, "files.json");
      fs.writeFileSync(fileListPath, JSON.stringify(processedFiles, null, 2), "utf8");

      mainLogger.info({ taskId, fileCount: processedFiles.length }, "文件列表已保存");
    } catch (error) {
      mainLogger.error({ error, taskId }, "保存文件列表失败");
    }
  }

  /**
   * 获取指定任务的文件列表
   */
  async getTaskFiles(taskId: string): Promise<ProcessedFile[]> {
    try {
      const taskDir = path.join(config.LOG_DIR, "tasks", taskId);
      const fileListPath = path.join(taskDir, "files.json");

      if (!fs.existsSync(fileListPath)) {
        mainLogger.warn({ taskId }, "任务文件列表不存在");
        return [];
      }

      const fileContent = fs.readFileSync(fileListPath, "utf8");
      const files: ProcessedFile[] = JSON.parse(fileContent);

      mainLogger.info({ taskId, fileCount: files.length }, "已加载任务文件列表");
      return files;
    } catch (error) {
      mainLogger.error({ error, taskId }, "加载任务文件列表失败");
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

    // 一次性保存到磁盘
    await this.saveFileList(taskId, processedFiles);
  }

  /**
   * 批量更新文件到指定状态
   */
  async batchUpdateFilesToStatus(
    taskId: string,
    processedFiles: ProcessedFile[],
    fileNames: string[],
    status: FileProcessStatus,
    stage: FileProcessStage,
    progress: number
  ): Promise<void> {
    const updates = fileNames.map(fileName => ({
      fileName,
      updates: {
        status,
        processStage: stage,
        progress,
      }
    }));

    await this.batchUpdateAndSaveFileStatus(taskId, processedFiles, updates);
  }

  /**
   * 获取指定状态的文件统计
   */
  getFilesByStatus(processedFiles: ProcessedFile[], status: FileProcessStatus): ProcessedFile[] {
    return processedFiles.filter(file => file.status === status);
  }

  /**
   * 获取处理进度统计
   */
  getProgressStats(processedFiles: ProcessedFile[]): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
    progressPercentage: number;
  } {
    const total = processedFiles.length;
    const pending = this.getFilesByStatus(processedFiles, 'pending').length;
    const processing = processedFiles.filter(file =>
      ['similarity_matching', 'similarity_matched', 'ai_classifying', 'ai_classified', 'moving'].includes(file.status)
    ).length;
    const completed = this.getFilesByStatus(processedFiles, 'success').length;
    const failed = this.getFilesByStatus(processedFiles, 'failed').length;
    const skipped = this.getFilesByStatus(processedFiles, 'skipped').length;

    const progressPercentage = total > 0 ? Math.round(((completed + failed + skipped) / total) * 100) : 0;

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      skipped,
      progressPercentage
    };
  }

  /**
   * 检查任务是否完成
   */
  isTaskComplete(processedFiles: ProcessedFile[]): boolean {
    const stats = this.getProgressStats(processedFiles);
    return stats.total > 0 && (stats.completed + stats.failed + stats.skipped) === stats.total;
  }
}