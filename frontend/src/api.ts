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
      headers: { 'Content-Type': 'application/json' }
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
  }
};

