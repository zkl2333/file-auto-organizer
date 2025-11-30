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

    // 在浏览器环境中，不允许直接调用 loadConfig，应通过 API 获取配置
    if (typeof window !== 'undefined') {
      throw new Error('loadConfig 不能在浏览器环境中调用，请使用 API 获取配置');
    }

    // 在服务端环境中，尝试读取配置文件
    const fs = await import('fs/promises');
    const yaml = await import('js-yaml');

    // 检查配置文件是否存在
    let configExists = false;
    try {
      await fs.access(path);
      configExists = true;
    } catch {
      configExists = false;
    }

    // 如果配置文件不存在，创建默认配置文件
    if (!configExists) {
      console.log(`配置文件 ${path} 不存在，正在创建默认配置文件...`);
      const defaultYaml = yaml.dump(defaultConfig, {
        indent: 2,
        lineWidth: -1,
        quotingType: '"',
        forceQuotes: false,
      });
      const configWithComment = `# File Auto Organizer 配置文件\n# 首次运行自动生成，请根据需要修改配置\n\n${defaultYaml}`;
      await fs.writeFile(path, configWithComment, 'utf-8');
      console.log(`默认配置文件已创建: ${path}`);
      currentConfig = defaultConfig;
    } else {
      // 读取并解析配置文件
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
        console.error(`配置文件 ${path} 格式错误，使用默认配置:`, error);
        currentConfig = defaultConfig;
      }
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    throw error;
  }

  // 验证待处理目录是否存在
  await validateDirectories();

  return currentConfig;
}

/**
 * 验证必要目录是否存在
 */
async function validateDirectories(): Promise<void> {
  const fs = await import('fs/promises');
  const { incoming_dir } = currentConfig.directories;

  try {
    const stat = await fs.stat(incoming_dir);
    if (!stat.isDirectory()) {
      throw new Error(`待处理路径 ${incoming_dir} 不是目录`);
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`待处理目录 ${incoming_dir} 不存在，请先创建该目录`);
    }
    throw error;
  }
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

// 仅在服务端初始化时加载配置
if (typeof window === 'undefined') {
  loadConfig()
    .then(() => {
      applyEnvOverrides();
    })
    .catch((error) => {
      console.error('初始化配置失败:', error);
    });
}
