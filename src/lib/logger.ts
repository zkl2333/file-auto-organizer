import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { createStream } from 'rotating-file-stream';
import { getDataDir, ensureDataDir } from './paths';

/**
 * 简化的日志系统
 * 单一日志文件（按天轮转） + 控制台输出
 */

// 使用 DATA_DIR() 作为默认日志目录
const LOG_DIR = path.resolve(process.env.LOG_DIR || getDataDir());

// 确保日志目录存在（同步方式，因为模块加载时需要）
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 异步确保数据目录存在（用于日志轮转等操作）
if (typeof process !== 'undefined' && typeof window === 'undefined') {
  ensureDataDir().catch((error) => {
    console.error('Failed to ensure data directory:', error);
  });
}

// 创建按天轮转的日志流
const rotatingStream = createStream(
  (time: Date | number | string) => {
    if (!time) return 'app.log';
    const d = typeof time === 'string' ? new Date(time) : new Date(time);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `app-${year}-${month}-${day}.log`;
  },
  {
    path: LOG_DIR,
    interval: '1d', // 每天轮转
    maxFiles: 30, // 保留30天
    compress: false,
  }
);

// 创建日志器实例
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    { stream: process.stdout, level: process.env.LOG_LEVEL || 'info' },
    { stream: rotatingStream, level: process.env.LOG_LEVEL || 'info' },
  ])
);

/**
 * 刷新日志流
 */
export function flushLogs(): void {
  // pino 和 rotating-file-stream 会自动刷新
}

/**
 * 清理日志资源
 */
export function cleanupLogFiles(): void {
  flushLogs();
}
