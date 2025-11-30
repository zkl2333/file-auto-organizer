import {
  TaskStatus,
  TaskProgress,
  TaskStats,
  TaskMetadata,
  TaskSnapshot,
  ProgressListener,
} from './types';
import type { ProcessedFile } from '@/lib/api-client';
import type { TaskStatsRecord } from '@/lib/services/stats.service';

/**
 * 任务实体类
 * 封装单个任务的完整生命周期和状态
 */
export class Task {
  public readonly taskId: string;
  public status: TaskStatus;
  public readonly startTime: number;
  public endTime: number | null = null;
  public readonly dryRun: boolean;

  private _progress: TaskProgress;
  private _stats: TaskStats;
  private _files: ProcessedFile[] = [];
  private _metadata: TaskMetadata;
  private _errorMessage?: string;
  private _progressListeners: ProgressListener[] = [];

  constructor(
    taskId: string,
    options: {
      dryRun: boolean;
      triggeredBy: 'manual' | 'cron' | 'api';
      metadata?: Partial<TaskMetadata>;
    }
  ) {
    this.taskId = taskId;
    this.status = TaskStatus.CREATED;
    this.startTime = Date.now();
    this.dryRun = options.dryRun;

    // 初始化进度
    this._progress = {
      totalFiles: 0,
      scannedFiles: 0,
      processedFiles: 0,
      similarityMatched: 0,
      aiClassified: 0,
      currentStage: 'init',
      percentage: 0,
    };

    // 初始化统计
    this._stats = {
      similarityMatched: 0,
      aiClassified: 0,
      totalProcessed: 0,
      tokensUsed: 0,
      aiCalls: 0,
      fileTypes: {},
    };

    // 初始化元数据
    this._metadata = {
      createdAt: this.startTime,
      triggeredBy: options.triggeredBy,
      ...options.metadata,
    };
  }

  // Getters
  get progress(): TaskProgress {
    return { ...this._progress };
  }

  get stats(): TaskStats {
    return { ...this._stats };
  }

  get files(): ProcessedFile[] {
    return [...this._files];
  }

  get metadata(): TaskMetadata {
    return { ...this._metadata };
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  /**
   * 开始任务
   */
  start(): void {
    if (this.status !== TaskStatus.CREATED) {
      throw new Error(`任务 ${this.taskId} 已经启动，当前状态: ${this.status}`);
    }
    this.status = TaskStatus.RUNNING;
    this._progress.currentStage = 'scan';
  }

  /**
   * 完成任务
   */
  complete(result: { stats: TaskStats }): void {
    this.status = TaskStatus.SUCCESS;
    this.endTime = Date.now();
    this._stats = result.stats;
    this._progress.currentStage = 'complete';
    this._progress.percentage = 100;
  }

  /**
   * 任务失败
   */
  fail(error: Error | string): void {
    this.status = TaskStatus.FAILED;
    this.endTime = Date.now();
    this._errorMessage = typeof error === 'string' ? error : error.message;
    this._progress.currentStage = 'complete';
  }

  /**
   * 更新进度
   */
  updateProgress(updates: Partial<TaskProgress>): void {
    Object.assign(this._progress, updates);

    // 自动计算百分比
    if (this._progress.totalFiles > 0) {
      this._progress.percentage = Math.round(
        (this._progress.processedFiles / this._progress.totalFiles) * 100
      );
    }

    // 触发进度监听器
    this._progressListeners.forEach((listener) => listener(this._progress));
  }

  /**
   * 更新统计信息
   */
  updateStats(updates: Partial<TaskStats>): void {
    Object.assign(this._stats, updates);
  }

  /**
   * 添加文件
   */
  addFile(file: ProcessedFile): void {
    this._files.push({ ...file, taskId: this.taskId });
  }

  /**
   * 批量添加文件
   */
  addFiles(files: ProcessedFile[]): void {
    files.forEach((file) => this.addFile(file));
  }

  /**
   * 更新文件状态
   */
  updateFile(fileName: string, updates: Partial<ProcessedFile>): void {
    const file = this._files.find((f) => f.name === fileName);
    if (file) {
      Object.assign(file, updates);
      file.timestamp = Date.now();
    }
  }

  /**
   * 注册进度监听器
   */
  onProgress(listener: ProgressListener): void {
    this._progressListeners.push(listener);
  }

  /**
   * 移除进度监听器
   */
  offProgress(listener: ProgressListener): void {
    const index = this._progressListeners.indexOf(listener);
    if (index !== -1) {
      this._progressListeners.splice(index, 1);
    }
  }

  /**
   * 获取任务快照（用于API响应）
   */
  getSnapshot(): TaskSnapshot {
    return {
      taskId: this.taskId,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      dryRun: this.dryRun,
      progress: this.progress,
      stats: this.stats,
      metadata: this.metadata,
      errorMessage: this._errorMessage,
    };
  }

  /**
   * 检查任务是否正在运行
   */
  isRunning(): boolean {
    return this.status === TaskStatus.RUNNING;
  }

  /**
   * 检查任务是否已完成（成功或失败）
   */
  isCompleted(): boolean {
    return this.status === TaskStatus.SUCCESS || this.status === TaskStatus.FAILED;
  }

  /**
   * 获取任务持续时间
   */
  getDuration(): number {
    if (this.endTime) {
      return this.endTime - this.startTime;
    }
    return Date.now() - this.startTime;
  }

  /**
   * 转换为统计服务所需的记录格式
   */
  toStatsRecord(): Omit<TaskStatsRecord, 'timestamp'> {
    return {
      taskId: this.taskId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: this.endTime ? new Date(this.endTime).toISOString() : '',
      duration: this.getDuration(),
      aiCalls: this._stats.aiCalls,
      tokensUsed: this._stats.tokensUsed,
      filesProcessed: this._stats.totalProcessed,
      similarityMatched: this._stats.similarityMatched,
      aiClassified: this._stats.aiClassified,
      fileTypes: this._stats.fileTypes,
      status:
        this.status === TaskStatus.SUCCESS
          ? 'success'
          : this.status === TaskStatus.FAILED
            ? 'failed'
            : this.status === TaskStatus.RUNNING
              ? 'running'
              : 'partial',
      errorMessage: this._errorMessage,
      dryRun: this.dryRun,
    };
  }
}
