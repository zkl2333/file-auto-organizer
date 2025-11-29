import { TaskConfig } from '@/types';

// 配置接口定义
interface AppConfig {
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
  timezone: string;
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

// 默认配置
const defaultConfig: AppConfig = {
  timezone: 'Asia/Shanghai',
  openai: {
    api_key: '',
    model: 'gpt-4',
    base_url: '',
  },
  directories: {
    root_dir: './分类库',
    incoming_dir: './待分类',
  },
  cron: {
    enabled: false,
    schedule: '0 */6 * * *', // 每6小时执行一次
  },
  logging: {
    level: 'info',
    dir: './logs',
  },
  scan: {
    max_depth: 10,
    similarity_threshold: 0.8,
  },
  ai: {
    batch_size: 10,
  },
  file_operations: {
    max_retries: 3,
    retry_delay_base: 1000,
  },
};

// 当前配置实例
let currentConfig: AppConfig = defaultConfig;

/**
 * 加载配置文件
 */
export async function loadConfig(configPath?: string): Promise<AppConfig> {
  try {
    const path = configPath || process.env.CONFIG_PATH || './config.yaml';

    // 在浏览器环境中，使用默认配置
    if (typeof window !== 'undefined') {
      currentConfig = defaultConfig;
      return currentConfig;
    }

    // 在服务端环境中，尝试读取配置文件
    const fs = await import('fs/promises');
    const yaml = await import('js-yaml');

    try {
      const configContent = await fs.readFile(path, 'utf-8');
      const userConfig = yaml.load(configContent) as Partial<AppConfig>;

      // 合并用户配置和默认配置
      currentConfig = {
        ...defaultConfig,
        ...userConfig,
        openai: {
          ...defaultConfig.openai,
          ...userConfig.openai,
        },
        directories: {
          ...defaultConfig.directories,
          ...userConfig.directories,
        },
        cron: {
          ...defaultConfig.cron,
          ...userConfig.cron,
        },
        logging: {
          ...defaultConfig.logging,
          ...userConfig.logging,
        },
        scan: {
          ...defaultConfig.scan,
          ...userConfig.scan,
        },
        ai: {
          ...defaultConfig.ai,
          ...userConfig.ai,
        },
        file_operations: {
          ...defaultConfig.file_operations,
          ...userConfig.file_operations,
        },
      };
    } catch (error) {
      console.warn(`配置文件 ${path} 不存在或格式错误，使用默认配置:`, error);
      currentConfig = defaultConfig;
    }
  } catch (error) {
    console.error('加载配置失败，使用默认配置:', error);
    currentConfig = defaultConfig;
  }

  return currentConfig;
}

/**
 * 获取当前配置
 */
export function getConfig(): AppConfig {
  return currentConfig;
}

/**
 * 更新配置
 */
export function updateConfig(updates: Partial<AppConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...updates,
    openai: {
      ...currentConfig.openai,
      ...updates.openai,
    },
    directories: {
      ...currentConfig.directories,
      ...updates.directories,
    },
    cron: {
      ...currentConfig.cron,
      ...updates.cron,
    },
    logging: {
      ...currentConfig.logging,
      ...updates.logging,
    },
    scan: {
      ...currentConfig.scan,
      ...updates.scan,
    },
    ai: {
      ...currentConfig.ai,
      ...updates.ai,
    },
    file_operations: {
      ...currentConfig.file_operations,
      ...updates.file_operations,
    },
  };
}

/**
 * 转换为任务配置格式
 */
export function getTaskConfig(): TaskConfig {
  const config = getConfig();
  return {
    rootDir: config.directories.root_dir,
    incomingDir: config.directories.incoming_dir,
    similarityThreshold: config.scan.similarity_threshold,
    aiProvider: 'openai',
    aiModel: config.openai.model,
    enableMove: true,
    enableAI: true,
    enableSimilarityCheck: config.scan.similarity_threshold > 0,
  };
}

/**
 * 环境变量配置覆盖
 */
export function applyEnvOverrides(): void {
  const envOverrides: Partial<AppConfig> = {
    openai: {
      api_key: process.env.OPENAI_API_KEY || currentConfig.openai.api_key,
      model: process.env.OPENAI_MODEL || currentConfig.openai.model,
      base_url: process.env.OPENAI_BASE_URL || currentConfig.openai.base_url,
    },
    directories: {
      root_dir: process.env.ROOT_DIR || currentConfig.directories.root_dir,
      incoming_dir: process.env.INCOMING_DIR || currentConfig.directories.incoming_dir,
    },
    logging: {
      level: process.env.LOG_LEVEL || currentConfig.logging.level,
      dir: process.env.LOG_DIR || currentConfig.logging.dir,
    },
    scan: {
      similarity_threshold: parseFloat(
        process.env.SIMILARITY_THRESHOLD || String(currentConfig.scan.similarity_threshold)
      ),
      max_depth: parseInt(process.env.SCAN_MAX_DEPTH || String(currentConfig.scan.max_depth)),
    },
  };

  updateConfig(envOverrides);
}

// 初始化时加载配置
loadConfig()
  .then(() => {
    applyEnvOverrides();
  })
  .catch((error) => {
    console.error('初始化配置失败:', error);
  });
