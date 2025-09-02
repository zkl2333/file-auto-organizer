import pino from "pino";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

// 日志类型枚举
export enum LoggerType {
  SYSTEM = "system",      // 系统日志 (index.ts)
  MAIN = "main",          // 主服务日志 (main.service.ts)
  AI = "ai",              // AI分类日志 (ai-classification.service.ts)
  FILE_MOVE = "file-move", // 文件移动日志 (file-move.service.ts)
  FILE_SCAN = "file-scan", // 文件扫描日志 (file-scan.service.ts)
  FILE_INFO = "file-info", // 文件解析日志 (file-info.service.ts)
}

// 日志文件路径配置 - 固定文件名
const LOG_PATHS = {
  [LoggerType.SYSTEM]: path.join(config.LOG_DIR, "system.log"),
  [LoggerType.MAIN]: path.join(config.LOG_DIR, "main.log"),
  [LoggerType.AI]: path.join(config.LOG_DIR, "ai.log"),
  [LoggerType.FILE_MOVE]: path.join(config.LOG_DIR, "file-move.log"),
  [LoggerType.FILE_SCAN]: path.join(config.LOG_DIR, "file-scan.log"),
  [LoggerType.FILE_INFO]: path.join(config.LOG_DIR, "file-info.log"),
};

// 存储所有日志器实例和文件句柄
const loggerInstances = new Map<LoggerType, pino.Logger>();
const fileDestinations = new Map<LoggerType, ReturnType<typeof pino.destination>>();

// 控制台日志目标（所有日志器共享）
const consoleDestination = pino.destination({ sync: true, fd: 1 });

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
    minLength: 4096,
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
      { stream: fileDestination }
    ])
  );

  return logger;
}

/**
 * 获取指定类型的日志器（单例模式）
 */
export function getLogger(type: LoggerType): pino.Logger {
  if (!loggerInstances.has(type)) {
    const logger = createLogger(type);
    loggerInstances.set(type, logger);
  }
  return loggerInstances.get(type)!;
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
}
