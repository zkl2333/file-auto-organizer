import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';

/**
 * 简化的日志服务
 * 读取按天轮转的日志文件 logs/app-YYYY-MM-DD.log
 */

const LOG_DIR = path.join(process.cwd(), 'logs');

/**
 * 读取日志文件（读取最新的日志文件）
 * @param limit 读取行数限制
 * @returns 日志行数组
 */
export async function readLogFiles(limit: number = 200): Promise<string[]> {
  try {
    const logDir = LOG_DIR;

    // 检查日志目录是否存在
    if (!fs.existsSync(logDir)) {
      logger.debug({ logDir }, '日志目录不存在');
      return [];
    }

    // 查找最新的日志文件
    const files = fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith('app-') && f.endsWith('.log'))
      .sort()
      .reverse(); // 按日期倒序

    // 也检查 app.log（当天未轮转的情况）
    if (fs.existsSync(path.join(logDir, 'app.log'))) {
      files.unshift('app.log');
    }

    if (files.length === 0) {
      logger.debug({ logDir }, '没有找到日志文件');
      return [];
    }

    // 从最新的日志文件读取
    const allLines: string[] = [];
    for (const file of files) {
      if (allLines.length >= limit) break;

      const logPath = path.join(logDir, file);
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      allLines.push(...lines);
    }

    // 返回最后的 N 行
    return allLines.slice(-limit);
  } catch (error) {
    logger.error({ error, limit }, '读取日志文件失败');
    return [];
  }
}

/**
 * 获取日志文件信息
 */
export function getLogFileInfo() {
  const logDir = LOG_DIR;

  try {
    if (!fs.existsSync(logDir)) {
      return {
        exists: false,
        size: 0,
        modified: null,
        lines: 0,
      };
    }

    // 查找日志文件
    const files = fs
      .readdirSync(logDir)
      .filter((f) => (f.startsWith('app-') && f.endsWith('.log')) || f === 'app.log');

    if (files.length === 0) {
      return {
        exists: false,
        size: 0,
        modified: null,
        lines: 0,
      };
    }

    // 计算总大小和行数
    let totalSize = 0;
    let totalLines = 0;
    let latestModified: Date | null = null;

    for (const file of files) {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim()).length;

      totalSize += stats.size;
      totalLines += lines;

      if (!latestModified || stats.mtime > latestModified) {
        latestModified = stats.mtime;
      }
    }

    return {
      exists: true,
      size: totalSize,
      modified: latestModified,
      lines: totalLines,
      fileCount: files.length,
      path: logDir,
    };
  } catch (error) {
    logger.error({ error }, '获取日志文件信息失败');
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
 * 清理旧日志文件（保留最近 N 天）
 */
export function cleanupOldLogs(daysToKeep: number = 30): void {
  const logsDir = LOG_DIR;

  try {
    if (!fs.existsSync(logsDir)) {
      return;
    }

    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // 清理旧的日志文件
    const files = fs.readdirSync(logsDir);
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && stats.mtime < cutoffTime) {
        fs.unlinkSync(filePath);
        logger.info({ filePath }, '删除旧日志文件');
      }
    }

    // 清理 tasks 目录下的旧文件
    const tasksDir = path.join(logsDir, 'tasks');
    if (fs.existsSync(tasksDir)) {
      const taskDirs = fs.readdirSync(tasksDir, { withFileTypes: true });

      for (const entry of taskDirs) {
        if (entry.isDirectory()) {
          const taskDirPath = path.join(tasksDir, entry.name);
          const filesJsonPath = path.join(taskDirPath, 'files.json');

          if (fs.existsSync(filesJsonPath)) {
            const stats = fs.statSync(filesJsonPath);
            if (stats.mtime < cutoffTime) {
              fs.rmSync(taskDirPath, { recursive: true, force: true });
              logger.info({ taskId: entry.name }, '删除旧任务文件');
            }
          }
        }
      }
    }

    logger.info({ daysToKeep }, '日志清理完成');
  } catch (error) {
    logger.error({ error, daysToKeep }, '清理旧日志文件失败');
  }
}
