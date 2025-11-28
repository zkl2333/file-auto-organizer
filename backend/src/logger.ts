import pino from "pino";
import fs from "node:fs";
import path from "node:path";
import { createStream } from "rotating-file-stream";
import { config } from "./config.js";

/**
 * 日志系统重构说明:
 *
 * 1. 日志分组策略 (全局+任务双记录):
 *    - 全局日志 (logs/global/): 记录所有日志,便于全局查看
 *      · system.log - 系统启动、停止、定时任务调度
 *      · server.log - HTTP API请求响应
 *      · main.log - 所有任务的主流程控制
 *      · file-scan.log - 所有文件扫描详情
 *      · file-info.log - 所有文件信息解析
 *      · file-move.log - 所有文件移动操作
 *      · ai.log - 所有AI分类调用详情
 *
 *    - 任务日志 (logs/tasks/{taskId}/): 记录具体任务的执行详细过程
 *      · main.log - 本任务的主流程控制
 *      · file-scan.log - 本任务的文件扫描详情
 *      · file-info.log - 本任务的文件信息解析
 *      · file-move.log - 本任务的文件移动操作
 *      · ai.log - 本任务的AI分类调用详情
 *
 * 2. 日志输出规则:
 *    - 所有模块: 始终输出到全局日志文件
 *    - 任务模块: 有任务上下文时,额外输出到任务日志文件
 *    - 控制台: 所有日志都输出到控制台
 *
 * 3. 日志级别规范:
 *    - fatal: 致命错误,服务无法继续运行
 *    - error: 错误,但服务可以继续
 *    - warn: 警告,需要关注但不影响功能
 *    - info: 关键信息点(任务开始/结束、重要操作等)
 *    - debug: 调试信息(详细流程、中间状态)
 *    - trace: 追踪信息(最详细的执行细节)
 */

// 当前任务上下文
interface TaskContext {
  taskId: string;
  startTime: Date;
  dryRun: boolean;
}

let currentTaskContext: TaskContext | null = null;

// 日志模块枚举
export enum LogModule {
  SYSTEM = "system", // 系统日志(全局+任务双记录)
  SERVER = "server", // 服务器日志(全局+任务双记录)
  MAIN = "main", // 主服务日志(全局+任务双记录)
  FILE_SCAN = "file-scan", // 文件扫描日志(全局+任务双记录)
  FILE_INFO = "file-info", // 文件信息日志(全局+任务双记录)
  FILE_MOVE = "file-move", // 文件移动日志(全局+任务双记录)
  AI = "ai", // AI分类日志(全局+任务双记录)
}

// 全局日志路径配置
export const GLOBAL_LOG_PATHS = {
  [LogModule.SYSTEM]: path.join(config.LOG_DIR, "global", "system.log"),
  [LogModule.SERVER]: path.join(config.LOG_DIR, "global", "server.log"),
  [LogModule.MAIN]: path.join(config.LOG_DIR, "global", "main.log"),
  [LogModule.FILE_SCAN]: path.join(config.LOG_DIR, "global", "file-scan.log"),
  [LogModule.FILE_INFO]: path.join(config.LOG_DIR, "global", "file-info.log"),
  [LogModule.FILE_MOVE]: path.join(config.LOG_DIR, "global", "file-move.log"),
  [LogModule.AI]: path.join(config.LOG_DIR, "global", "ai.log"),
};

/**
 * 获取任务级日志路径
 */
export function getTaskLogPath(module: LogModule, taskId: string): string {
  return path.join(config.LOG_DIR, "tasks", taskId, `${module}.log`);
}

// 日志器实例管理
interface LoggerInstance {
  logger: pino.Logger;
  globalDest: ReturnType<typeof createStream>;
}

const loggerInstances = new Map<LogModule, LoggerInstance>();
const taskDestinations = new Map<string, Map<LogModule, ReturnType<typeof pino.destination>>>();

// 控制台日志目标（所有日志器共享）
const consoleDestination = pino.destination({ sync: false, fd: 1 });

/**
 * 创建全局日志的轮转流（按天轮转，保留30天）
 */
function createRotatingStream(module: LogModule): ReturnType<typeof createStream> {
  const logDir = path.join(config.LOG_DIR, "global");

  // 确保日志目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 生成轮转流
  // 文件名格式: system-2025-11-28.log
  return createStream(
    (time: Date | number | string) => {
      if (!time) return `${module}.log`;
      const d = typeof time === "string" ? new Date(time) : new Date(time);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${module}-${year}-${month}-${day}.log`;
    },
    {
      path: logDir,
      interval: "1d", // 每天轮转一次
      maxFiles: 30, // 保留最近30天的日志
      compress: false, // 不压缩（可选，压缩可以节省空间）
    }
  );
}

/**
 * 设置当前任务上下文
 */
export function setCurrentTaskId(taskId: string | null, dryRun: boolean = false): void {
  if (taskId) {
    currentTaskContext = {
      taskId,
      startTime: new Date(),
      dryRun,
    };

    // 创建任务日志目录
    const taskLogDir = path.join(config.LOG_DIR, "tasks", taskId);
    if (!fs.existsSync(taskLogDir)) {
      fs.mkdirSync(taskLogDir, { recursive: true });
    }

    // 初始化任务日志流
    initTaskLogStreams(taskId);
  } else {
    // 清理任务上下文
    if (currentTaskContext) {
      cleanupTaskLogStreams(currentTaskContext.taskId);
      currentTaskContext = null;
    }
  }
}

/**
 * 初始化任务日志流
 */
function initTaskLogStreams(taskId: string): void {
  if (!taskDestinations.has(taskId)) {
    taskDestinations.set(taskId, new Map());
  }
}

/**
 * 清理任务日志流
 */
function cleanupTaskLogStreams(taskId: string): void {
  const taskDests = taskDestinations.get(taskId);
  if (taskDests) {
    taskDests.forEach((dest) => {
      try {
        dest.flushSync();
        // 注意: pino.destination 不提供 close 方法,flush后由GC处理
      } catch (err) {
        // 忽略清理错误
      }
    });
    taskDestinations.delete(taskId);
  }
}

/**
 * 创建日志器(单例模式，全局+任务双记录)
 */
function createLogger(module: LogModule): pino.Logger {
  // 如果已存在,直接返回
  if (loggerInstances.has(module)) {
    return loggerInstances.get(module)!.logger;
  }

  // 创建全局日志轮转流
  const globalDest = createRotatingStream(module);

  // 创建日志器(输出到控制台和全局日志文件)
  const logger = pino(
    {
      level: config.LOG_LEVEL,
      base: { module },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream([
      { stream: consoleDestination, level: config.LOG_LEVEL },
      { stream: globalDest, level: config.LOG_LEVEL },
    ])
  );

  // 缓存日志器实例
  loggerInstances.set(module, { logger, globalDest });

  return logger;
}

/**
 * 获取或创建任务级日志目标
 */
function getOrCreateTaskDestination(
  module: LogModule,
  taskId: string
): ReturnType<typeof pino.destination> {
  let taskDests = taskDestinations.get(taskId);
  if (!taskDests) {
    taskDests = new Map();
    taskDestinations.set(taskId, taskDests);
  }

  if (!taskDests.has(module)) {
    const taskLogPath = getTaskLogPath(module, taskId);
    const taskLogDir = path.dirname(taskLogPath);

    if (!fs.existsSync(taskLogDir)) {
      fs.mkdirSync(taskLogDir, { recursive: true });
    }

    const dest = pino.destination({
      dest: taskLogPath,
      minLength: 4096,
      sync: false,
    });

    taskDests.set(module, dest);
  }

  return taskDests.get(module)!;
}

/**
 * 创建带任务上下文的日志器包装
 * 所有模块在有任务上下文时都额外写入任务日志
 */
function wrapLoggerWithTaskContext(baseLogger: pino.Logger, module: LogModule): pino.Logger {
  // 创建代理，拦截日志方法
  return new Proxy(baseLogger, {
    get(target, prop) {
      const original = target[prop as keyof pino.Logger];

      // 拦截日志方法
      if (
        typeof original === "function" &&
        ["trace", "debug", "info", "warn", "error", "fatal"].includes(prop as string)
      ) {
        return function (...args: any[]) {
          // 如果有任务上下文,额外写入任务日志文件
          if (currentTaskContext) {
            const taskDest = getOrCreateTaskDestination(module, currentTaskContext.taskId);
            const level = prop as string;
            const [objOrMsg, msg] = args;
            const logObj = typeof objOrMsg === "object" ? objOrMsg : {};
            const logMsg = typeof objOrMsg === "string" ? objOrMsg : msg;

            const entry = {
              level: pino.levels.values[level as keyof typeof pino.levels.values],
              time: Date.now(),
              module,
              taskId: currentTaskContext.taskId,
              dryRun: currentTaskContext.dryRun,
              ...logObj,
              msg: logMsg,
            };

            taskDest.write(JSON.stringify(entry) + "\n");
          }

          // 同时调用原始方法(会输出到控制台和全局日志)
          return (original as any).apply(target, args);
        };
      }

      return original;
    },
  }) as pino.Logger;
}

/**
 * 获取指定模块的日志器(单例模式)
 */
function getLogger(module: LogModule): pino.Logger {
  // 创建基础日志器(已包含全局日志)
  const baseLogger = createLogger(module);

  // 包装任务上下文支持
  return wrapLoggerWithTaskContext(baseLogger, module);
}

// 导出各模块专用日志器
export const systemLogger = getLogger(LogModule.SYSTEM);
export const mainLogger = getLogger(LogModule.MAIN);
export const fileScanLogger = getLogger(LogModule.FILE_SCAN);
export const fileInfoLogger = getLogger(LogModule.FILE_INFO);
export const fileMoveLogger = getLogger(LogModule.FILE_MOVE);
export const aiLogger = getLogger(LogModule.AI);

/**
 * 刷新所有日志流
 */
export function flushLogs(): void {
  // 刷新任务日志
  taskDestinations.forEach((taskDests) => {
    taskDests.forEach((dest) => {
      try {
        dest.flushSync();
      } catch (err) {
        // 忽略刷新错误
      }
    });
  });

  // 刷新控制台
  try {
    consoleDestination.flushSync();
  } catch (err) {
    // 忽略刷新错误
  }
}

/**
 * 清理所有日志资源
 */
export function cleanupLogFiles(): void {
  // 先刷新
  flushLogs();

  // 清理所有任务日志流
  taskDestinations.forEach((taskDests, taskId) => {
    cleanupTaskLogStreams(taskId);
  });
  taskDestinations.clear();
}
