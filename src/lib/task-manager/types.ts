/**
 * 任务状态枚举
 */
export enum TaskStatus {
  CREATED = 'created', // 已创建
  RUNNING = 'running', // 运行中
  SUCCESS = 'success', // 成功完成
  FAILED = 'failed', // 失败
}

/**
 * 任务进度信息
 */
export interface TaskProgress {
  totalFiles: number;
  scannedFiles: number;
  processedFiles: number;
  similarityMatched: number;
  aiClassified: number;
  currentStage: 'init' | 'scan' | 'process' | 'finalize' | 'complete';
  percentage: number; // 0-100
}

/**
 * 任务统计信息
 */
export interface TaskStats {
  similarityMatched: number;
  aiClassified: number;
  totalProcessed: number;
  tokensUsed: number;
  aiCalls: number;
  fileTypes: Record<string, number>;
}

/**
 * 任务元数据
 */
export interface TaskMetadata {
  createdAt: number;
  createdBy?: string; // 未来扩展：支持多用户
  triggeredBy: 'manual' | 'cron' | 'api';
  tags?: string[]; // 未来扩展：任务标签
}

/**
 * 任务快照（用于API返回）
 */
export interface TaskSnapshot {
  taskId: string;
  status: TaskStatus;
  startTime: number;
  endTime: number | null;
  duration: number;
  dryRun: boolean;
  progress: TaskProgress;
  stats: TaskStats;
  metadata: TaskMetadata;
  errorMessage?: string;
}

/**
 * 任务创建选项
 */
export interface TaskCreateOptions {
  dryRun?: boolean;
  triggeredBy?: 'manual' | 'cron' | 'api';
  metadata?: Partial<TaskMetadata>;
}

/**
 * 任务结果
 */
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  duration: number;
  stats: TaskStats;
  errorMessage?: string;
}

/**
 * 进度监听器类型
 */
export type ProgressListener = (progress: TaskProgress) => void;
