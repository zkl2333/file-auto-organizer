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
  lastRunTime: string | null;
  lastRunStats: {
    similarityMatched: number;
    aiClassified: number;
    totalProcessed: number;
    duration: number;
  } | null;
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
      method: 'POST'
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
      body: yamlContent
    });
    return res.json();
  },

  updateConfigJson: async (config: ConfigJson): Promise<ConfigResult> => {
    const res = await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return res.json();
  },

  getUsageStats: async (range: 'today' | 'week' | 'month' | 'all' = 'all'): Promise<UsageStats> => {
    const res = await fetch(`/api/usage-stats?range=${range}`);
    return res.json();
  },

  getFiles: async (path?: string, base: 'root' | 'incoming' = 'root'): Promise<FileListResponse> => {
    const params = new URLSearchParams();
    if (path) params.set('path', path);
    if (base === 'incoming') params.set('base', 'incoming');
    const res = await fetch(`/api/files?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`获取文件列表失败: ${res.statusText}`);
    }
    return res.json();
  }
};

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number | null;
  modified: string;
}

export interface FileListResponse {
  type: 'directory' | 'file';
  path: string;
  items?: FileItem[];
  name?: string;
  size?: number;
  modified?: string;
}

