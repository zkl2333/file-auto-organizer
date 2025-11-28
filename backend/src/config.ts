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
    enabled: true,
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

/**
 * 查找配置文件
 * 优先级：环境变量 > cwd/config.yaml (Docker) > cwd/../config.yaml (本地开发)
 */
export function findConfigFile(): string | null {
  // 1. 环境变量指定
  if (process.env.CONFIG_PATH) {
    const envPath = path.resolve(process.env.CONFIG_PATH);
    if (fs.existsSync(envPath)) return envPath;
  }
  
  // 2. 当前工作目录 (Docker: /app/config.yaml)
  const cwdPath = path.resolve(process.cwd(), "config.yaml");
  if (fs.existsSync(cwdPath)) return cwdPath;
  
  // 3. 父目录 (本地开发: backend/../config.yaml)
  const parentPath = path.resolve(process.cwd(), "..", "config.yaml");
  if (fs.existsSync(parentPath)) return parentPath;
  
  return null;
}

// 配置文件路径（用于解析相对路径）
let configFilePath: string | null = null;

/**
 * 获取基准目录（配置文件所在目录）
 */
function getBaseDir(): string {
  return configFilePath ? path.dirname(configFilePath) : process.cwd();
}

/**
 * 解析路径（相对路径基于配置文件目录，绝对路径保持不变）
 */
function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(getBaseDir(), p);
}

// 加载配置文件
function loadConfig(): ConfigFile {
  configFilePath = findConfigFile();

  try {
    if (configFilePath) {
      const fileContent = fs.readFileSync(configFilePath, "utf8");
      const loadedConfig = yaml.load(fileContent) as ConfigFile;

      // 合并默认配置和加载的配置
      return mergeConfig(defaultConfig, loadedConfig);
    } else {
      console.warn(`配置文件 config.yaml 不存在，使用默认配置`);
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

// 加载配置
const loadedConfig = loadConfig();

/**
 * 重新加载配置（用于热更新）
 */
export function reloadConfig(): ConfigFile {
  return loadConfig();
}

/**
 * 获取当前配置快照（每次调用重新读取）
 */
export function getConfigSnapshot() {
  const freshConfig = reloadConfig();
  return {
    OPENAI_API_KEY: freshConfig.openai.api_key,
    OPENAI_MODEL: freshConfig.openai.model,
    OPENAI_BASE_URL: freshConfig.openai.base_url,
    ROOT_DIR: resolvePath(freshConfig.directories.root_dir),
    INCOMING_DIR: resolvePath(freshConfig.directories.incoming_dir),
    CRON_ENABLED: freshConfig.cron.enabled ?? true,
    CRON_SCHEDULE: freshConfig.cron.schedule,
    // 以下配置使用环境变量或启动时配置，不支持热更新
    LOG_LEVEL: process.env.LOG_LEVEL || freshConfig.logging.level,
    LOG_DIR: process.env.LOG_DIR ? resolvePath(process.env.LOG_DIR) : resolvePath(freshConfig.logging.dir),
    MAX_SCAN_DEPTH: freshConfig.scan.max_depth,
    SIMILARITY_THRESHOLD: freshConfig.scan.similarity_threshold,
    AI_BATCH_SIZE: freshConfig.ai.batch_size,
    FILE_MAX_RETRIES: freshConfig.file_operations.max_retries,
    FILE_RETRY_DELAY_BASE: freshConfig.file_operations.retry_delay_base,
  } as const;
}

// 导出配置文件基准目录
export const CONFIG_BASE_DIR = getBaseDir();

// 导出配置对象（保持原有接口兼容性）
// 相对路径解析为绝对路径（相对于配置文件所在目录），绝对路径保持不变
export const config = {
  OPENAI_API_KEY: loadedConfig.openai.api_key,
  OPENAI_MODEL: loadedConfig.openai.model,
  OPENAI_BASE_URL: loadedConfig.openai.base_url,
  ROOT_DIR: resolvePath(loadedConfig.directories.root_dir),
  INCOMING_DIR: resolvePath(loadedConfig.directories.incoming_dir),
  CRON_ENABLED: loadedConfig.cron.enabled ?? true,
  CRON_SCHEDULE: loadedConfig.cron.schedule,
  LOG_LEVEL: loadedConfig.logging.level,
  LOG_DIR: resolvePath(loadedConfig.logging.dir),
  MAX_SCAN_DEPTH: loadedConfig.scan.max_depth,
  SIMILARITY_THRESHOLD: loadedConfig.scan.similarity_threshold,
  AI_BATCH_SIZE: loadedConfig.ai.batch_size,
  FILE_MAX_RETRIES: loadedConfig.file_operations.max_retries,
  FILE_RETRY_DELAY_BASE: loadedConfig.file_operations.retry_delay_base,
} as const;

export type AppConfig = typeof config;
