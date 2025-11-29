import path from 'node:path';
import { getConfig } from './config';

/**
 * 日志系统配置
 * 适配原后端日志配置到 Next.js
 */

// 导出日志模块枚举（与原后端保持一致）
export enum LogModule {
  SYSTEM = 'system', // 系统日志
  SERVER = 'server', // 服务器日志
  MAIN = 'main', // 主服务日志
  FILE_SCAN = 'file-scan', // 文件扫描日志
  FILE_INFO = 'file-info', // 文件信息日志
  FILE_MOVE = 'file-move', // 文件移动日志
  AI = 'ai', // AI分类日志
}

// 获取日志配置
export function getLogConfig() {
  const config = getConfig();
  return {
    LOG_DIR: path.resolve(config.logging.dir),
    LOG_LEVEL: config.logging.level,
    LOG_MAX_FILES: 30, // 保留30天日志
    LOG_INTERVAL: '1d', // 每天轮转
  };
}

// 全局日志路径配置
export function getGlobalLogPaths(): Record<LogModule, string> {
  const { LOG_DIR } = getLogConfig();
  return {
    [LogModule.SYSTEM]: path.join(LOG_DIR, 'global', 'system.log'),
    [LogModule.SERVER]: path.join(LOG_DIR, 'global', 'server.log'),
    [LogModule.MAIN]: path.join(LOG_DIR, 'global', 'main.log'),
    [LogModule.FILE_SCAN]: path.join(LOG_DIR, 'global', 'file-scan.log'),
    [LogModule.FILE_INFO]: path.join(LOG_DIR, 'global', 'file-info.log'),
    [LogModule.FILE_MOVE]: path.join(LOG_DIR, 'global', 'file-move.log'),
    [LogModule.AI]: path.join(LOG_DIR, 'global', 'ai.log'),
  };
}

/**
 * 获取任务级日志路径
 */
export function getTaskLogPath(module: LogModule, taskId: string): string {
  const { LOG_DIR } = getLogConfig();
  return path.join(LOG_DIR, 'tasks', taskId, `${module}.log`);
}
