import { systemLogger } from './logger';

/**
 * 日志系统初始化
 * 在应用启动时调用，记录启动信息并集成 Next.js 日志
 */

export function initializeLogging() {
  // 记录应用启动
  systemLogger.info(
    {
      nodeEnv: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown',
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      nextVersion: process.env.npm_package_next_version || 'unknown',
    },
    'Next.js 应用启动'
  );

  // 记录配置信息
  const config = {
    logLevel: process.env.LOG_LEVEL || 'info',
    port: process.env.PORT || '3000',
    timezone: process.env.TZ || 'system',
    nextDev: process.env.NODE_ENV === 'development',
    turbo: process.env.TURBOPACK === '1' || process.env.NEXT_TURBOPACK === '1',
  };

  systemLogger.info({ config }, 'Next.js 应用配置已加载');

  // 记录 Next.js 特定信息
  systemLogger.info(
    {
      webpackVersion: process.env.npm_package_webpack_version || 'unknown',
      reactVersion: process.env.npm_package_react_version || 'unknown',
      typescript: process.env.TYPECHECK === 'true' || true,
    },
    'Next.js 运行时环境信息'
  );

  // 设置优雅关闭处理
  const setupGracefulShutdown = (signal: string) => {
    systemLogger.info({ signal }, `收到 ${signal} 信号，准备关闭应用`);

    // 给日志系统一些时间来刷新缓冲区
    setTimeout(() => {
      systemLogger.info('Next.js 应用已关闭');
      process.exit(0);
    }, 1000);
  };

  process.on('SIGINT', () => setupGracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => setupGracefulShutdown('SIGTERM'));

  process.on('uncaughtException', (error) => {
    systemLogger.error(
      {
        error: error.message,
        stack: error.stack,
        name: error.name,
      },
      'Next.js 未捕获异常'
    );

    // 给日志系统时间记录错误
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    systemLogger.error(
      {
        reason: String(reason),
        promise: promise.toString(),
        type: typeof reason,
      },
      'Next.js 未处理的 Promise 拒绝'
    );
  });

  // 监听内存使用情况（生产环境）
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      systemLogger.debug(
        {
          rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
          external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
        },
        'Next.js 内存使用情况'
      );
    }, 60000); // 每分钟记录一次
  }

  systemLogger.info('Next.js 日志系统初始化完成');
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
    timestamp: new Date().toISOString(),
  };

  if (statusCode >= 400) {
    systemLogger.error(logData, `API ${method} ${url} - ${statusCode}`);
  } else {
    systemLogger.info(logData, `API ${method} ${url} - ${statusCode}`);
  }
}
