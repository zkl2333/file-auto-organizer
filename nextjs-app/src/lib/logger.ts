// 简单的日志记录器，用于 Next.js 服务端
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}

class SimpleLogger {
  private log(level: LogLevel, message: string, data?: any) {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    // 在开发环境中输出到控制台
    if (process.env.NODE_ENV === 'development') {
      const logData = data ? ` ${JSON.stringify(data)}` : '';
      console.log(`[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}${logData}`);
    }

    // 在生产环境中可以写入文件或发送到日志服务
    // 这里简化处理，实际项目中可以集成 Winston 或其他日志库
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }
}

export const systemLogger = new SimpleLogger();
