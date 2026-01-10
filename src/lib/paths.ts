import path from 'node:path';
import os from 'node:os';

/**
 * 获取应用配置目录（跨平台）
 * 类似于 Rust 的 dirs::config_dir()
 *
 * 基础配置目录（config_dir）根据操作系统和用户名变化：
 * - Linux: ~/.config（例如：/home/Alice/.config）
 * - Windows: %APPDATA%（例如：C:\Users\Alice\AppData\Roaming）
 * - macOS: ~/Library/Application Support（例如：/Users/Alice/Library/Application Support）
 *
 * 应用配置目录：
 * - 本地环境：config_dir / file-auto-organizer
 * - Docker 环境：$HOME/.config（根据 $HOME 拼接，无应用名称层，例如：/app/.config）
 */
export function getConfigDir(): string {
  const appName = 'file-auto-organizer';

  // Docker 环境检测：检查 HOME 环境变量是否指向容器内路径
  // 使用 HOME 环境变量而非写死路径，提高灵活性
  const homeDir = process.env.HOME || os.homedir();
  const isDockerEnv = homeDir.startsWith('/app') || homeDir.startsWith('/usr');

  // 在 Docker 容器中，配置目录直接使用 $HOME/.config，不添加应用名称层
  if (isDockerEnv) {
    return path.join(homeDir, '.config');
  }

  const platform = process.platform;

  switch (platform) {
    case 'win32': {
      // Windows: %APPDATA%\file-auto-organizer
      const appData = process.env.APPDATA;
      if (!appData) {
        throw new Error('APPDATA 环境变量未设置');
      }
      return path.join(appData, appName);
    }
    case 'darwin': {
      // macOS: ~/Library/Application Support/file-auto-organizer
      return path.join(homeDir, 'Library', 'Application Support', appName);
    }
    default: {
      // Linux 和其他 Unix-like: ~/.config/file-auto-organizer
      const xdgConfigHome = process.env.XDG_CONFIG_HOME;
      const configBase = xdgConfigHome || path.join(homeDir, '.config');
      return path.join(configBase, appName);
    }
  }
}

/**
 * 获取应用数据目录（跨平台）
 * 用于存放日志、缓存等非配置文件
 *
 * - Windows: %LOCALAPPDATA%\file-auto-organizer
 * - macOS: ~/Library/Application Support/file-auto-organizer
 * - Linux: ~/.local/share/file-auto-organizer
 *
 * Docker 环境：$HOME/.config/logs（配置和日志在同一父目录下）
 */
export function getDataDir(): string {
  const appName = 'file-auto-organizer';

  // Docker 环境检测：检查 HOME 环境变量是否指向容器内路径
  // 使用 HOME 环境变量而非写死路径，提高灵活性
  const homeDir = process.env.HOME || os.homedir();
  const isDockerEnv = homeDir.startsWith('/app') || homeDir.startsWith('/usr');

  // 在 Docker 容器中，数据目录使用 $HOME/.config/logs，与配置文件在同一父目录
  if (isDockerEnv) {
    return path.join(homeDir, '.config', 'logs');
  }

  const platform = process.platform;

  switch (platform) {
    case 'win32': {
      // Windows: %LOCALAPPDATA%\file-auto-organizer
      const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA;
      if (!localAppData) {
        throw new Error('LOCALAPPDATA 或 APPDATA 环境变量未设置');
      }
      return path.join(localAppData, appName);
    }
    case 'darwin': {
      // macOS: ~/Library/Application Support/file-auto-organizer
      // macOS 通常不区分 config 和 data
      return getConfigDir();
    }
    default: {
      // Linux 和其他 Unix-like: ~/.local/share/file-auto-organizer
      const xdgDataHome = process.env.XDG_DATA_HOME;
      const dataBase = xdgDataHome || path.join(homeDir, '.local', 'share');
      return path.join(dataBase, appName);
    }
  }
}

/**
 * 全局配置目录常量（延迟初始化）
 * 类似于 Rust 的 LazyLock<PathBuf>
 */
let _CONFIG_DIR: string | null = null;
let _DATA_DIR: string | null = null;

/**
 * 获取配置目录（单例模式）
 */
export function CONFIG_DIR(): string {
  if (_CONFIG_DIR === null) {
    _CONFIG_DIR = getConfigDir();
  }
  return _CONFIG_DIR;
}

/**
 * 获取数据目录（单例模式）
 */
export function DATA_DIR(): string {
  if (_DATA_DIR === null) {
    _DATA_DIR = getDataDir();
  }
  return _DATA_DIR;
}

/**
 * 确保配置目录存在
 */
export async function ensureConfigDir(): Promise<void> {
  const fs = await import('fs/promises');
  const configDir = CONFIG_DIR();

  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
}

/**
 * 确保数据目录存在
 */
export async function ensureDataDir(): Promise<void> {
  const fs = await import('fs/promises');
  const dataDir = DATA_DIR();

  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}
