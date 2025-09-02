import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// 配置文件接口定义
interface ConfigFile {
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

// 默认配置
const defaultConfig: ConfigFile = {
  openai: {
    api_key: "",
    model: "gpt-5-nano",
    base_url: "",
  },
  directories: {
    root_dir: "./分类库",
    incoming_dir: "./待分类",
  },
  cron: {
    schedule: "0 * * * *",
  },
  logging: {
    level: "info",
    dir: "./logs",
  },
  scan: {
    max_depth: 3,
    similarity_threshold: 0.65,
  },
  ai: {
    batch_size: 5,
  },
  file_operations: {
    max_retries: 3,
    retry_delay_base: 1000,
  },
};

// 加载配置文件
function loadConfig(): ConfigFile {
  const configPath = path.resolve(process.cwd(), "config.yaml");

  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, "utf8");
      const loadedConfig = yaml.load(fileContent) as ConfigFile;

      // 合并默认配置和加载的配置
      return mergeConfig(defaultConfig, loadedConfig);
    } else {
      console.warn(`配置文件 ${configPath} 不存在，使用默认配置`);
      return defaultConfig;
    }
  } catch (error) {
    console.error(`加载配置文件失败: ${error}`);
    console.warn("使用默认配置");
    return defaultConfig;
  }
}

// 深度合并配置
function mergeConfig(defaultConfig: ConfigFile, loadedConfig: Partial<ConfigFile>): ConfigFile {
  const merged = { ...defaultConfig };

  if (loadedConfig.openai) {
    merged.openai = { ...merged.openai, ...loadedConfig.openai };
  }
  if (loadedConfig.directories) {
    merged.directories = { ...merged.directories, ...loadedConfig.directories };
  }
  if (loadedConfig.cron) {
    merged.cron = { ...merged.cron, ...loadedConfig.cron };
  }
  if (loadedConfig.logging) {
    merged.logging = { ...merged.logging, ...loadedConfig.logging };
  }
  if (loadedConfig.scan) {
    merged.scan = { ...merged.scan, ...loadedConfig.scan };
  }
  if (loadedConfig.ai) {
    merged.ai = { ...merged.ai, ...loadedConfig.ai };
  }
  if (loadedConfig.file_operations) {
    merged.file_operations = { ...merged.file_operations, ...loadedConfig.file_operations };
  }

  return merged;
}

// 检查命令行参数
function hasArg(flag: string): boolean {
  return process.argv.includes(flag);
}

// 加载配置
const loadedConfig = loadConfig();

// 导出配置对象（保持原有接口兼容性）
export const config = {
  OPENAI_API_KEY: loadedConfig.openai.api_key,
  OPENAI_MODEL: loadedConfig.openai.model,
  OPENAI_BASE_URL: loadedConfig.openai.base_url,
  ROOT_DIR: loadedConfig.directories.root_dir,
  INCOMING_DIR: loadedConfig.directories.incoming_dir,
  CRON_SCHEDULE: loadedConfig.cron.schedule,
  LOG_LEVEL: loadedConfig.logging.level,
  LOG_DIR: loadedConfig.logging.dir,
  MAX_SCAN_DEPTH: loadedConfig.scan.max_depth,
  SIMILARITY_THRESHOLD: loadedConfig.scan.similarity_threshold,
  AI_BATCH_SIZE: loadedConfig.ai.batch_size,
  FILE_MAX_RETRIES: loadedConfig.file_operations.max_retries,
  FILE_RETRY_DELAY_BASE: loadedConfig.file_operations.retry_delay_base,
  DRY_RUN: hasArg("--dry-run"),
  RUN_ONCE: hasArg("--once"),
} as const;

export type AppConfig = typeof config;
