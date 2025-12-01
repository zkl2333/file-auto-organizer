import { logger, flushLogs } from './logger';

let initialized = false;

/**
 * 日志系统初始化
 * 在 Next.js 服务器启动时通过 instrumentation.ts 调用
 */
export function initializeLogging() {
  // 防止重复初始化
  if (initialized) return;
  initialized = true;

  // 记录服务器启动
  logger.info(
    {
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    },
    'Next.js 服务器启动'
  );

  // 记录关闭信号（只记录日志，不主动退出，让 Next.js 处理）
  process.once('SIGINT', () => {
    logger.info({ signal: 'SIGINT' }, '收到终止信号');
    flushLogs();
  });

  process.once('SIGTERM', () => {
    logger.info({ signal: 'SIGTERM' }, '收到终止信号');
    flushLogs();
  });

  // 记录未捕获异常（只记录，不退出）
  process.on('uncaughtException', (error) => {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        name: error.name,
      },
      '未捕获异常'
    );
    flushLogs();
  });

  // 记录未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason) => {
    logger.error(
      {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      },
      '未处理的 Promise 拒绝'
    );
  });

  logger.info('日志系统初始化完成');
}
