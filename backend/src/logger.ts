import pino from "pino";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

/**
 * 日志系统重构说明:
 * 
 * 1. 日志分组策略:
 *    - 全局日志 (logs/global/): 仅记录系统级和服务级通用信息
 *      · system.log - 系统启动、停止、定时任务调度
 *      · server.log - HTTP API请求响应
 *    
 *    - 任务日志 (logs/tasks/{taskId}/): 记录具体任务执行的详细过程
 *      · main.log - 任务主流程控制
 *      · file-scan.log - 文件扫描详情
 *      · file-info.log - 文件信息解析
 *      · file-move.log - 文件移动操作
 *      · ai.log - AI分类调用详情
 * 
 * 2. 日志输出规则:
 *    - 全局日志: 仅输出到 global 目录
 *    - 任务日志: 仅输出到对应任务目录
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
  SYSTEM = "system",        // 系统日志(仅全局)
  SERVER = "server",        // 服务器日志(仅全局)
  MAIN = "main",            // 主服务日志(仅任务)
  FILE_SCAN = "file-scan",  // 文件扫描日志(仅任务)
  FILE_INFO = "file-info",  // 文件信息日志(仅任务)
  FILE_MOVE = "file-move",  // 文件移动日志(仅任务)
  AI = "ai",                // AI分类日志(仅任务)
}

// 仅全局日志的模块
const GLOBAL_ONLY_MODULES = new Set([LogModule.SYSTEM, LogModule.SERVER]);

// 仅任务日志的模块
const TASK_ONLY_MODULES = new Set([
  LogModule.MAIN,
  LogModule.FILE_SCAN,
  LogModule.FILE_INFO,
  LogModule.FILE_MOVE,
  LogModule.AI,
]);

// 保持向后兼容
export const LoggerType = LogModule;

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

// 向后兼容
export const LOG_PATHS = GLOBAL_LOG_PATHS;

/**
 * 获取任务级日志路径
 */
export function getTaskLogPath(module: LogModule, taskId: string): string {
  return path.join(config.LOG_DIR, "tasks", taskId, `${module}.log`);
}

/**
 * 获取任务日志目录
 */
export function getTaskLogDir(taskId: string): string {
  return path.join(config.LOG_DIR, "tasks", taskId);
}

// 日志器实例管理
interface LoggerInstance {
  logger: pino.Logger;
  globalDest: ReturnType<typeof pino.destination>;
}

const loggerInstances = new Map<LogModule, LoggerInstance>();
const taskDestinations = new Map<string, Map<LogModule, ReturnType<typeof pino.destination>>>();

// 控制台日志目标（所有日志器共享）
const consoleDestination = pino.destination({ sync: false, fd: 1 });

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
    const taskLogDir = getTaskLogDir(taskId);
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
 * 获取当前任务ID
 */
export function getCurrentTaskId(): string | null {
  return currentTaskContext?.taskId || null;
}

/**
 * 获取当前任务上下文
 */
export function getCurrentTaskContext(): TaskContext | null {
  return currentTaskContext;
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
 * 创建全局日志器(单例模式)
 * 只为 GLOBAL_ONLY_MODULES 创建
 */
function createGlobalLogger(module: LogModule): pino.Logger {
  // 如果已存在,直接返回
  if (loggerInstances.has(module)) {
    return loggerInstances.get(module)!.logger;
  }

  const logPath = GLOBAL_LOG_PATHS[module];
  const logDir = path.dirname(logPath);
  
  // 确保日志目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 创建全局日志文件目标
  const globalDest = pino.destination({
    dest: logPath,
    minLength: 4096, // 4KB缓冲
    sync: false,
  });

  // 创建日志器(仅输出到控制台和全局日志文件)
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
 * 创建任务日志器
 * 只为 TASK_ONLY_MODULES 创建,仅在有任务上下文时输出到文件
 */
function createTaskLogger(module: LogModule): pino.Logger {
  // 如果已存在,直接返回
  if (loggerInstances.has(module)) {
    return loggerInstances.get(module)!.logger;
  }

  // 任务日志器基础配置(仅输出到控制台,任务日志通过 child logger 动态添加)
  const logger = pino(
    {
      level: config.LOG_LEVEL,
      base: { module },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    consoleDestination
  );

  // 缓存日志器实例(不需要 globalDest)
  loggerInstances.set(module, { logger, globalDest: null as any });
  
  return logger;
}

/**
 * 获取或创建任务级日志目标
 */
function getOrCreateTaskDestination(module: LogModule, taskId: string): ReturnType<typeof pino.destination> {
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
 * 仅对 TASK_ONLY_MODULES 有效
 */
function wrapLoggerWithTaskContext(baseLogger: pino.Logger, module: LogModule): pino.Logger {
  // 如果是全局日志模块,直接返回原始日志器
  if (GLOBAL_ONLY_MODULES.has(module)) {
    return baseLogger;
  }

  // 对任务日志模块,创建代理
  return new Proxy(baseLogger, {
    get(target, prop) {
      const original = target[prop as keyof pino.Logger];
      
      // 拦截日志方法
      if (typeof original === 'function' && ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(prop as string)) {
        return function(...args: any[]) {
          // 如果有任务上下文,写入任务日志文件
          if (currentTaskContext) {
            const taskDest = getOrCreateTaskDestination(module, currentTaskContext.taskId);
            const level = prop as string;
            const [objOrMsg, msg] = args;
            const logObj = typeof objOrMsg === 'object' ? objOrMsg : {};
            const logMsg = typeof objOrMsg === 'string' ? objOrMsg : msg;
            
            const entry = {
              level: pino.levels.values[level as keyof typeof pino.levels.values],
              time: Date.now(),
              module,
              taskId: currentTaskContext.taskId,
              dryRun: currentTaskContext.dryRun,
              ...logObj,
              msg: logMsg,
            };
            
            taskDest.write(JSON.stringify(entry) + '\n');
          }
          
          // 同时输出到控制台
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
export function getLogger(module: LogModule): pino.Logger {
  let baseLogger: pino.Logger;
  
  if (GLOBAL_ONLY_MODULES.has(module)) {
    // 全局日志模块
    baseLogger = createGlobalLogger(module);
  } else {
    // 任务日志模块
    baseLogger = createTaskLogger(module);
  }
  
  return wrapLoggerWithTaskContext(baseLogger, module);
}

// 导出各模块专用日志器
export const systemLogger = getLogger(LogModule.SYSTEM);
export const serverLogger = getLogger(LogModule.SERVER);
export const mainLogger = getLogger(LogModule.MAIN);
export const fileScanLogger = getLogger(LogModule.FILE_SCAN);
export const fileInfoLogger = getLogger(LogModule.FILE_INFO);
export const fileMoveLogger = getLogger(LogModule.FILE_MOVE);
export const aiLogger = getLogger(LogModule.AI);

// 保持向后兼容性
export const logger = systemLogger;

/**
 * 刷新所有日志流
 */
export function flushLogs(): void {
  // 刷新全局日志
  loggerInstances.forEach(({ globalDest }) => {
    try {
      globalDest.flushSync();
    } catch (err) {
      // 忽略刷新错误
    }
  });
  
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

// 定期刷新日志(每10秒)
setInterval(() => {
  loggerInstances.forEach(({ globalDest }) => {
    try {
      globalDest.flush();
    } catch (err) {
      // 忽略刷新错误
    }
  });
}, 10000);
