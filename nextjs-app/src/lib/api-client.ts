export interface Stats {
  directories: {
    rootDir: string;
    incomingDir: string;
    rootDirExists: boolean;
    incomingDirExists: boolean;
  };
  files: {
    totalInRoot: number;
    totalInIncoming: number;
    categories: number;
  };
  config: {
    cronSchedule: string;
    logLevel: string;
    similarityThreshold: number;
    aiBatchSize: number;
  };
}

export interface TaskStatus {
  isRunning: boolean;
  currentTaskId: string | null;
  lastRunTime: string | null;
  lastRunStats: {
    similarityMatched: number;
    aiClassified: number;
    totalProcessed: number;
    duration: number;
  } | null;
  cronEnabled: boolean | null;
  lastTask: TaskRecord | null;
}

export interface LogEntry {
  time?: string;
  level?: number;
  msg?: string;
  [key: string]: unknown;
}

export interface TriggerResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface ConfigResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface ConfigData {
  yaml: string;
  json: Partial<ConfigJson> | null;
}

export interface ConfigJson {
  openai: {
    api_key: string;
    model: string;
    base_url: string;
  };
  directories: {
    root_dir: string;
    incoming_dir: string;
  };
  cron: {
    enabled: boolean;
    schedule: string;
  };
  logging: {
    level: string;
    dir: string;
  };
  scan: {
    max_depth: number;
    similarity_threshold: number;
  };
  ai: {
    batch_size: number;
  };
  file_operations: {
    max_retries: number;
    retry_delay_base: number;
  };
}

export interface UsageStats {
  totalAiCalls: number;
  totalTokensUsed: number;
  totalFilesProcessed: number;
  fileTypes: Record<string, number>;
  dailyTrends: Array<{
    date: string;
    aiCalls: number;
    tokensUsed: number;
    filesProcessed: number;
  }>;
}

// 文件处理状态类型
export type FileProcessStatus =
  | 'pending' // 待处理（扫描完成）
  | 'similarity_matching' // 相似度匹配中
  | 'similarity_matched' // 相似度匹配完成
  | 'ai_classifying' // AI分类中
  | 'ai_classified' // AI分类完成
  | 'moving' // 移动中
  | 'success' // 处理成功
  | 'failed' // 处理失败
  | 'skipped'; // 跳过

// 文件处理阶段
export type FileProcessStage = 'scan' | 'similarity' | 'ai' | 'move' | 'complete';

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
  reasoning?: string; // AI分类原因
  timestamp: number;
  // 新增字段
  processStage?: FileProcessStage; // 当前处理阶段
  progress?: number; // 处理进度 0-100
}

export interface TaskFileList {
  taskId: string;
  files: ProcessedFile[];
  totalFiles: number;
}

export interface TaskRecord {
  taskId: string;
  timestamp: string;
  startTime: string;
  endTime: string;
  duration: number;
  aiCalls: number;
  tokensUsed: number;
  filesProcessed: number;
  similarityMatched: number;
  aiClassified: number;
  fileTypes: Record<string, number>;
  status: 'success' | 'partial' | 'failed' | 'running';
  errorMessage?: string;
  dryRun: boolean;
}

export const api = {
  getStats: async (): Promise<Stats> => {
    const res = await fetch('/api/stats');
    return res.json();
  },

  getStatus: async (): Promise<TaskStatus> => {
    const res = await fetch('/api/status');
    return res.json();
  },

  getLogs: async (type: string, limit: number = 200): Promise<{ logs: string[] }> => {
    const res = await fetch(`/api/logs?type=${type}&limit=${limit}`);
    return res.json();
  },

  triggerTask: async (dryRun: boolean = false): Promise<TriggerResult> => {
    const url = dryRun ? '/api/trigger?dryRun=true' : '/api/trigger';
    const res = await fetch(url, {
      method: 'POST',
    });
    return res.json();
  },

  getConfig: async (): Promise<ConfigData> => {
    const res = await fetch('/api/config');
    return res.json();
  },

  updateConfig: async (yamlContent: string): Promise<ConfigResult> => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: yamlContent,
    });
    return res.json();
  },

  updateConfigJson: async (config: ConfigJson): Promise<ConfigResult> => {
    const res = await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  getUsageStats: async (range: 'today' | 'week' | 'month' | 'all' = 'all'): Promise<UsageStats> => {
    const res = await fetch(`/api/usage-stats?range=${range}`);
    return res.json();
  },

  getTaskHistory: async (): Promise<{ tasks: TaskRecord[] }> => {
    const res = await fetch('/api/task-history');
    return res.json();
  },

  getTaskDetail: async (taskId: string): Promise<TaskRecord> => {
    const res = await fetch(`/api/task/${taskId}`);
    return res.json();
  },

  deleteTask: async (taskId: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`/api/task/${taskId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  deleteTasks: async (
    taskIds: string[]
  ): Promise<{ success: boolean; message: string; deleted: string[]; notFound: string[] }> => {
    const res = await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds }),
    });
    return res.json();
  },

  getTaskLogs: async (
    taskId: string,
    type: string = 'main',
    limit: number = 200
  ): Promise<{ logs: string[] }> => {
    const res = await fetch(`/api/task/${taskId}/logs?type=${type}&limit=${limit}`);
    return res.json();
  },

  getTaskFiles: async (taskId: string): Promise<TaskFileList> => {
    const res = await fetch(`/api/task/${taskId}/files`);
    return res.json();
  },

  toggleCron: async (
    enabled: boolean
  ): Promise<{ success: boolean; message: string; enabled: boolean }> => {
    const res = await fetch('/api/cron/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return res.json();
  },
};
