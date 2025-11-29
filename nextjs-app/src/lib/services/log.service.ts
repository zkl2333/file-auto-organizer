import fs from 'node:fs';
import path from 'node:path';
import { systemLogger } from '@/lib/logger';

// 日志模块枚举
export enum LogModule {
  SYSTEM = 'system', // 系统日志
  SERVER = 'server', // 服务器日志
  MAIN = 'main', // 主服务日志
  FILE_SCAN = 'file-scan', // 文件扫描日志
  FILE_INFO = 'file-info', // 文件信息日志
  FILE_MOVE = 'file-move', // 文件移动日志
  AI = 'ai', // AI分类日志
}

// 全局日志路径配置
export const GLOBAL_LOG_PATHS: Record<LogModule, string> = {
  [LogModule.SYSTEM]: path.join(process.cwd(), 'logs', 'global', 'system.log'),
  [LogModule.SERVER]: path.join(process.cwd(), 'logs', 'global', 'server.log'),
  [LogModule.MAIN]: path.join(process.cwd(), 'logs', 'global', 'main.log'),
  [LogModule.FILE_SCAN]: path.join(process.cwd(), 'logs', 'global', 'file-scan.log'),
  [LogModule.FILE_INFO]: path.join(process.cwd(), 'logs', 'global', 'file-info.log'),
  [LogModule.FILE_MOVE]: path.join(process.cwd(), 'logs', 'global', 'file-move.log'),
  [LogModule.AI]: path.join(process.cwd(), 'logs', 'global', 'ai.log'),
};

/**
 * 获取任务级日志路径
 */
export function getTaskLogPath(module: LogModule, taskId: string): string {
  return path.join(process.cwd(), 'logs', 'tasks', taskId, `${module}.log`);
}

/**
 * 读取日志文件
 * @param type 日志类型
 * @param limit 读取行数限制
 * @param taskId 任务ID（可选，用于读取任务日志）
 * @returns 日志行数组
 */
export async function readLogFiles(
  type: string,
  limit: number = 200,
  taskId?: string
): Promise<string[]> {
  try {
    // 确保日志类型是有效的
    const logModule = type as LogModule;
    if (!Object.values(LogModule).includes(logModule)) {
      systemLogger.warn({ type }, '无效的日志类型');
      return [];
    }

    let logPath: string;

    if (taskId) {
      // 读取任务日志
      logPath = getTaskLogPath(logModule, taskId);
    } else {
      // 读取全局日志
      logPath = GLOBAL_LOG_PATHS[logModule];
    }

    // 检查文件是否存在
    if (!fs.existsSync(logPath)) {
      systemLogger.debug({ logPath }, '日志文件不存在');
      return [];
    }

    // 读取文件内容
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    // 返回最后的 N 行
    return lines.slice(-limit);
  } catch (error) {
    systemLogger.error({ error, type, taskId, limit }, '读取日志文件失败');
    return [];
  }
}

/**
 * 获取可用的日志类型列表
 */
export function getAvailableLogTypes(): LogModule[] {
  return Object.values(LogModule);
}

/**
 * 获取日志文件信息
 */
export function getLogFileInfo(logModule: LogModule, taskId?: string) {
  const logPath = taskId ? getTaskLogPath(logModule, taskId) : GLOBAL_LOG_PATHS[logModule];

  try {
    if (!fs.existsSync(logPath)) {
      return {
        exists: false,
        size: 0,
        modified: null,
        lines: 0,
      };
    }

    const stats = fs.statSync(logPath);
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim()).length;

    return {
      exists: true,
      size: stats.size,
      modified: stats.mtime,
      lines,
      path: logPath,
    };
  } catch (error) {
    systemLogger.error({ error, logModule, taskId }, '获取日志文件信息失败');
    return {
      exists: false,
      size: 0,
      modified: null,
      lines: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 清理旧日志文件
 */
export function cleanupOldLogs(daysToKeep: number = 30): void {
  const logsDir = path.join(process.cwd(), 'logs');

  try {
    if (!fs.existsSync(logsDir)) {
      return;
    }

    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // 递归删除旧日志文件
    function cleanupDirectory(dir: string): void {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          cleanupDirectory(itemPath);

          // 如果目录为空，删除目录
          try {
            const remainingItems = fs.readdirSync(itemPath);
            if (remainingItems.length === 0) {
              fs.rmdirSync(itemPath);
            }
          } catch {
            // 忽略删除目录时的错误
          }
        } else if (stats.mtime < cutoffTime) {
          fs.unlinkSync(itemPath);
          systemLogger.info({ filePath: itemPath }, '删除旧日志文件');
        }
      }
    }

    cleanupDirectory(logsDir);
    systemLogger.info({ daysToKeep }, '日志清理完成');
  } catch (error) {
    systemLogger.error({ error, daysToKeep }, '清理旧日志文件失败');
  }
}
