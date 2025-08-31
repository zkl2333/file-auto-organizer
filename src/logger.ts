import pino from "pino";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const destPath = config.LOG_FILE;
const destDir = path.dirname(destPath);
if (!fs.existsSync(destDir)) {
	fs.mkdirSync(destDir, { recursive: true });
}

const fileDestination = pino.destination({
	minLength: 4096,
	sync: false,
	fd: fs.openSync(destPath, "a"),
});
const consoleDestination = pino.destination(1);

export const logger = pino(
	{
		level: config.LOG_LEVEL,
		base: undefined,
		timestamp: pino.stdTimeFunctions.isoTime,
	},
	pino.multistream([
		{ stream: consoleDestination },
		{ stream: fileDestination },
	])
);


