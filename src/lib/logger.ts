import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { createStream } from 'rotating-file-stream';
import { getConfig } from './config';

/**
 * 简化的日志系统
 * 单一日志文件（按天轮转） + 控制台输出
 */

const config = getConfig();
const LOG_DIR = path.resolve(config.logging.dir);

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
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
    level: config.logging.level || process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    { stream: process.stdout, level: config.logging.level || 'info' },
    { stream: rotatingStream, level: config.logging.level || 'info' },
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
