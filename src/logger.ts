import pino from "pino";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const destPath = config.LOG_FILE;
const destDir = path.dirname(destPath);
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 文件日志
const fileDestination = pino.destination({
  minLength: 4096,
  sync: false,
  fd: fs.openSync(destPath, "a"),
});

// 控制台日志
const consoleDestination = pino.destination({ sync: true, fd: 1 });

export const logger = pino(
  {
    level: config.LOG_LEVEL,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([{ stream: consoleDestination }, { stream: fileDestination }])
);

process.on("beforeExit", () => {
  fileDestination.flush();
});
