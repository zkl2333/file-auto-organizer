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
  taskTrends: Array<{
    taskId: string;
    startTime: string;
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

// 文件处理方法
export type FileProcessMethod = 'similarity' | 'ai' | 'manual';

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
  taskId?: string; // 任务ID
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

// API 错误类
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 通用请求处理函数
async function handleApiRequest<T>(
  request: Promise<Response>,
  errorMessage: string = '请求失败'
): Promise<T> {
  try {
    const response = await request;

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }

      const message =
        typeof errorData === 'object' && errorData && 'message' in errorData
          ? String(errorData.message)
          : `${errorMessage}: HTTP ${response.status} ${response.statusText}`;

      throw new ApiError(message, response.status, response.statusText, errorData);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('网络连接失败，请检查网络设置');
    }

    throw new ApiError(`${errorMessage}: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export const api = {
  getStats: async (): Promise<Stats> => {
    return handleApiRequest(fetch('/api/stats'), '获取系统统计信息失败');
  },

  getStatus: async (): Promise<TaskStatus> => {
    return handleApiRequest(fetch('/api/status'), '获取任务状态失败');
  },

  getLogs: async (limit: number = 200): Promise<{ logs: string[] }> => {
    return handleApiRequest(fetch(`/api/logs?limit=${limit}`), '获取日志失败');
  },

  triggerTask: async (dryRun: boolean = false): Promise<TriggerResult> => {
    const url = dryRun ? '/api/trigger?dryRun=true' : '/api/trigger';
    return handleApiRequest(
      fetch(url, { method: 'POST' }),
      dryRun ? '执行模拟任务失败' : '执行任务失败'
    );
  },

  getConfig: async (): Promise<ConfigData> => {
    return handleApiRequest(fetch('/api/config'), '获取配置信息失败');
  },

  updateConfig: async (yamlContent: string): Promise<ConfigResult> => {
    return handleApiRequest(
      fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: yamlContent,
      }),
      '更新配置失败'
    );
  },

  updateConfigJson: async (config: ConfigJson): Promise<ConfigResult> => {
    return handleApiRequest(
      fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }),
      '更新配置失败'
    );
  },

  getUsageStats: async (range: 'today' | 'week' | 'month' | 'all' = 'all'): Promise<UsageStats> => {
    return handleApiRequest(fetch(`/api/usage-stats?range=${range}`), '获取使用统计失败');
  },

  getTaskHistory: async (): Promise<{ tasks: TaskRecord[] }> => {
    return handleApiRequest(fetch('/api/task-history'), '获取任务历史失败');
  },

  getTaskDetail: async (taskId: string): Promise<TaskRecord> => {
    return handleApiRequest(fetch(`/api/task/${taskId}`), '获取任务详情失败');
  },

  deleteTask: async (taskId: string): Promise<{ success: boolean; message: string }> => {
    return handleApiRequest(fetch(`/api/task/${taskId}`, { method: 'DELETE' }), '删除任务失败');
  },

  deleteTasks: async (
    taskIds: string[]
  ): Promise<{ success: boolean; message: string; deleted: string[]; notFound: string[] }> => {
    return handleApiRequest(
      fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds }),
      }),
      '批量删除任务失败'
    );
  },

  getTaskFiles: async (taskId: string): Promise<TaskFileList> => {
    return handleApiRequest(fetch(`/api/task/${taskId}/files`), '获取任务文件列表失败');
  },

  toggleCron: async (
    enabled: boolean
  ): Promise<{ success: boolean; message: string; enabled: boolean }> => {
    return handleApiRequest(
      fetch('/api/cron/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      }),
      '切换定时任务失败'
    );
  },
};
