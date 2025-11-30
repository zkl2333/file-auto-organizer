import { logger, flushLogs } from './logger';

/**
 * 日志系统初始化
 * 在应用启动时调用，记录启动信息
 */

export function initializeLogging() {
  // 记录应用启动
  logger.info(
    {
      nodeEnv: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown',
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    },
    '应用启动'
  );

  // 设置优雅关闭处理
  const setupGracefulShutdown = (signal: string) => {
    logger.info({ signal }, `收到 ${signal} 信号，准备关闭应用`);

    setTimeout(() => {
      flushLogs();
      logger.info('应用已关闭');
      process.exit(0);
    }, 1000);
  };

  process.on('SIGINT', () => setupGracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => setupGracefulShutdown('SIGTERM'));

  process.on('uncaughtException', (error) => {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        name: error.name,
      },
      '未捕获异常'
    );

    setTimeout(() => {
      flushLogs();
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      {
        reason: String(reason),
        promise: promise.toString(),
        type: typeof reason,
      },
      '未处理的 Promise 拒绝'
    );
  });

  logger.info('日志系统初始化完成');
}

/**
 * 记录API请求日志的辅助函数
 */
export function logApiRequest(
  method: string,
  url: string,
  statusCode: number,
  duration?: number,
  userAgent?: string,
  ip?: string
) {
  const logData = {
    method,
    url,
    statusCode,
    duration,
    userAgent,
    ip,
  };

  if (statusCode >= 400) {
    logger.error(logData, `API ${method} ${url} - ${statusCode}`);
  } else {
    logger.info(logData, `API ${method} ${url} - ${statusCode}`);
  }
}
