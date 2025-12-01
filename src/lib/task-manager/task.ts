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

// 状态映射表，避免运行时条件判断
const STATUS_MAP: Record<TaskStatus, TaskStatsRecord['status']> = {
  [TaskStatus.CREATED]: 'partial',
  [TaskStatus.RUNNING]: 'running',
  [TaskStatus.SUCCESS]: 'success',
  [TaskStatus.FAILED]: 'failed',
};

/**
 * 任务实体类
 * 封装单个任务的完整生命周期和状态
 */
export class Task {
  public readonly taskId: string;
  public status: TaskStatus = TaskStatus.CREATED;
  public readonly startTime: number;
  public endTime: number | null = null;
  public readonly dryRun: boolean;
  public errorMessage?: string;

  // 直接暴露只读引用，避免 getter 浅拷贝
  public readonly progress: TaskProgress;
  public readonly stats: TaskStats;
  public readonly files: ProcessedFile[] = [];
  public readonly metadata: TaskMetadata;

  private _progressListeners: ProgressListener[] = [];

  constructor(
    taskId: string,
    options: {
      dryRun: boolean;
      triggeredBy: 'manual' | 'cron' | 'api';
      metadata?: Partial<TaskMetadata>;
      startTime?: number;
    }
  ) {
    this.taskId = taskId;
    this.startTime = options.startTime ?? Date.now();
    this.dryRun = options.dryRun;

    // 初始化统计（合并进度中的重复字段）
    this.stats = {
      similarityMatched: 0,
      aiClassified: 0,
      totalProcessed: 0,
      tokensUsed: 0,
      aiCalls: 0,
      fileTypes: {},
    };

    // 进度引用 stats 中的字段，避免重复
    this.progress = {
      totalFiles: 0,
      scannedFiles: 0,
      processedFiles: 0,
      get similarityMatched() {
        return 0;
      }, // 将被 defineProperty 覆盖
      get aiClassified() {
        return 0;
      },
      currentStage: 'init',
      percentage: 0,
    };

    // 动态代理到 stats，避免数据重复
    const stats = this.stats;
    Object.defineProperties(this.progress, {
      similarityMatched: { get: () => stats.similarityMatched, enumerable: true },
      aiClassified: { get: () => stats.aiClassified, enumerable: true },
    });

    this.metadata = {
      createdAt: this.startTime,
      triggeredBy: options.triggeredBy,
      ...options.metadata,
    };
  }

  /**
   * 开始任务
   */
  start(): void {
    if (this.status !== TaskStatus.CREATED) {
      throw new Error(`任务 ${this.taskId} 已经启动，当前状态: ${this.status}`);
    }
    this.status = TaskStatus.RUNNING;
    this.progress.currentStage = 'scan';
  }

  /**
   * 完成任务
   */
  complete(result: { stats: TaskStats }): void {
    this.status = TaskStatus.SUCCESS;
    this.endTime = Date.now();
    Object.assign(this.stats, result.stats);
    this.progress.currentStage = 'complete';
    this.progress.percentage = 100;
  }

  /**
   * 任务失败
   */
  fail(error: Error | string): void {
    this.status = TaskStatus.FAILED;
    this.endTime = Date.now();
    this.errorMessage = typeof error === 'string' ? error : error.message;
    this.progress.currentStage = 'complete';
  }

  /**
   * 更新进度
   */
  updateProgress(updates: Partial<Omit<TaskProgress, 'similarityMatched' | 'aiClassified'>>): void {
    Object.assign(this.progress, updates);

    // 自动计算百分比
    if (this.progress.totalFiles > 0) {
      this.progress.percentage = Math.round(
        (this.progress.processedFiles / this.progress.totalFiles) * 100
      );
    }

    // 触发进度监听器
    this._progressListeners.forEach((listener) => listener(this.progress));
  }

  /**
   * 更新统计信息
   */
  updateStats(updates: Partial<TaskStats>): void {
    Object.assign(this.stats, updates);
  }

  /**
   * 添加文件（直接修改，不创建副本）
   */
  addFile(file: ProcessedFile): void {
    file.taskId = this.taskId;
    this.files.push(file);
  }

  /**
   * 批量添加文件
   */
  addFiles(files: ProcessedFile[]): void {
    for (const file of files) {
      file.taskId = this.taskId;
      this.files.push(file);
    }
  }

  /**
   * 更新文件状态
   */
  updateFile(fileName: string, updates: Partial<ProcessedFile>): void {
    const file = this.files.find((f) => f.name === fileName);
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
   * 获取任务快照（用于API响应，直接返回引用）
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
      errorMessage: this.errorMessage,
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
    return (this.endTime ?? Date.now()) - this.startTime;
  }

  /**
   * 转换为统计服务所需的记录格式
   */
  toStatsRecord(): Omit<TaskStatsRecord, 'timestamp'> {
    const { aiCalls, tokensUsed, totalProcessed, similarityMatched, aiClassified, fileTypes } =
      this.stats;
    return {
      taskId: this.taskId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: this.endTime ? new Date(this.endTime).toISOString() : '',
      aiCalls,
      tokensUsed,
      filesProcessed: totalProcessed,
      similarityMatched,
      aiClassified,
      fileTypes,
      status: STATUS_MAP[this.status],
      errorMessage: this.errorMessage,
      dryRun: this.dryRun,
    };
  }
}
