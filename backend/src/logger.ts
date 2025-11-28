import pino from "pino";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

// 当前任务ID（用于按任务组织日志）
let currentTaskId: string | null = null;

// 日志类型枚举
export enum LoggerType {
  SYSTEM = "system",      // 系统日志 (index.ts)
  MAIN = "main",          // 主服务日志 (main.service.ts)
  AI = "ai",              // AI分类日志 (ai-classification.service.ts)
  FILE_MOVE = "file-move", // 文件移动日志 (file-move.service.ts)
  FILE_SCAN = "file-scan", // 文件扫描日志 (file-scan.service.ts)
  FILE_INFO = "file-info", // 文件解析日志 (file-info.service.ts)
}

// 日志文件路径配置 - 支持任务级日志
export const LOG_PATHS = {
  [LoggerType.SYSTEM]: path.join(config.LOG_DIR, "system.log"),
  [LoggerType.MAIN]: path.join(config.LOG_DIR, "main.log"),
  [LoggerType.AI]: path.join(config.LOG_DIR, "ai.log"),
  [LoggerType.FILE_MOVE]: path.join(config.LOG_DIR, "file-move.log"),
  [LoggerType.FILE_SCAN]: path.join(config.LOG_DIR, "file-scan.log"),
  [LoggerType.FILE_INFO]: path.join(config.LOG_DIR, "file-info.log"),
};

/**
 * 获取任务级日志路径
 */
export function getTaskLogPath(type: LoggerType, taskId: string): string {
  return path.join(config.LOG_DIR, "tasks", taskId, `${type}.log`);
}

// 存储所有日志器实例和文件句柄
const loggerInstances = new Map<LoggerType, pino.Logger>();
const fileDestinations = new Map<LoggerType, ReturnType<typeof pino.destination>>();
const taskFileDestinations = new Map<string, Map<LoggerType, ReturnType<typeof pino.destination>>>();

// 控制台日志目标（所有日志器共享）
const consoleDestination = pino.destination({ sync: true, fd: 1 });

/**
 * 设置当前任务ID
 */
export function setCurrentTaskId(taskId: string | null): void {
  currentTaskId = taskId;
  if (taskId) {
    // 为新任务创建日志文件
    const taskLogDir = path.join(config.LOG_DIR, "tasks", taskId);
    if (!fs.existsSync(taskLogDir)) {
      fs.mkdirSync(taskLogDir, { recursive: true });
    }
  }
}

/**
 * 获取当前任务ID
 */
export function getCurrentTaskId(): string | null {
  return currentTaskId;
}

/**
 * 创建指定类型的日志器
 */
function createLogger(type: LoggerType): pino.Logger {
  const logPath = LOG_PATHS[type];
  const logDir = path.dirname(logPath);
  
  // 确保日志目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 创建文件日志目标
  const fileDestination = pino.destination({
    minLength: 512, // 减小缓冲区，更快写入文件
    sync: false,
    fd: fs.openSync(logPath, "a"),
  });

  // 存储文件目标以便后续清理
  fileDestinations.set(type, fileDestination);

  // 创建多流日志器（同时输出到控制台和对应的文件）
  const logger = pino(
    {
      level: config.LOG_LEVEL,
      base: { module: type }, // 添加模块标识
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream([
      { stream: consoleDestination },
      { stream: fileDestination },
      // 如果有任务ID，也写入任务专属日志
      ...(currentTaskId ? [{ stream: getOrCreateTaskDestination(type, currentTaskId) }] : [])
    ])
  );

  return logger;
}

/**
 * 获取或创建任务级日志目标
 */
function getOrCreateTaskDestination(type: LoggerType, taskId: string): ReturnType<typeof pino.destination> {
  if (!taskFileDestinations.has(taskId)) {
    taskFileDestinations.set(taskId, new Map());
  }
  
  const taskDests = taskFileDestinations.get(taskId)!;
  if (!taskDests.has(type)) {
    const taskLogPath = getTaskLogPath(type, taskId);
    const taskLogDir = path.dirname(taskLogPath);
    
    if (!fs.existsSync(taskLogDir)) {
      fs.mkdirSync(taskLogDir, { recursive: true });
    }
    
    const dest = pino.destination({
      minLength: 512,
      sync: false,
      fd: fs.openSync(taskLogPath, "a"),
    });
    
    taskDests.set(type, dest);
  }
  
  return taskDests.get(type)!;
}

/**
 * 获取指定类型的日志器（单例模式）
 * 注意：当任务ID变化时，需要重新创建日志器以包含新的任务日志流
 */
export function getLogger(type: LoggerType): pino.Logger {
  // 每次都重新创建，以便包含最新的任务日志流
  const logger = createLogger(type);
  loggerInstances.set(type, logger);
  return logger;
}

// 导出各种专用日志器
export const systemLogger = getLogger(LoggerType.SYSTEM);
export const mainLogger = getLogger(LoggerType.MAIN);
export const aiLogger = getLogger(LoggerType.AI);
export const fileMoveLogger = getLogger(LoggerType.FILE_MOVE);
export const fileScanLogger = getLogger(LoggerType.FILE_SCAN);
export const fileInfoLogger = getLogger(LoggerType.FILE_INFO);

// 保持向后兼容性，默认使用系统日志器
export const logger = systemLogger;

// 导出清理函数供进程管理器调用
export function cleanupLogFiles() {
  fileDestinations.forEach((destination) => {
    destination.flushSync();
  });
  // 清理任务日志
  taskFileDestinations.forEach((taskDests) => {
    taskDests.forEach((dest) => {
      dest.flushSync();
    });
  });
}

// 导出手动刷新函数（用于确保关键时刻日志写入）
export function flushLogs() {
  fileDestinations.forEach((destination) => {
    destination.flushSync();
  });
  // 刷新任务日志
  taskFileDestinations.forEach((taskDests) => {
    taskDests.forEach((dest) => {
      dest.flushSync();
    });
  });
}

// 每10秒自动刷新一次日志到文件（确保及时写入）
setInterval(() => {
  fileDestinations.forEach((destination) => {
    try {
      destination.flushSync();
    } catch (err) {
      // 忽略flush错误，避免影响主流程
    }
  });
}, 10000);
