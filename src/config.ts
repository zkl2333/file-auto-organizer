import dotenv from "dotenv";

dotenv.config();

function readString(name: string, defaultValue: string = ""): string {
	const value = process.env[name];
	return typeof value === "string" && value.length > 0 ? value : defaultValue;
}

function readNumber(name: string, defaultValue: number, opts?: { min?: number; max?: number; allowFloat?: boolean }): number {
	const raw = process.env[name];
	const parsed = raw !== undefined ? Number(raw) : defaultValue;
	if (!Number.isFinite(parsed)) return defaultValue;
	let n = parsed;
	if (!opts?.allowFloat) n = Math.floor(n);
	if (opts?.min !== undefined && n < opts.min) n = opts.min;
	if (opts?.max !== undefined && n > opts.max) n = opts.max;
	return n;
}

function hasArg(flag: string): boolean {
	return process.argv.includes(flag);
}

export const config = {
	OPENAI_API_KEY: readString("OPENAI_API_KEY", ""),
	OPENAI_MODEL: readString("OPENAI_MODEL", "gpt-4o-mini"),
	OPENAI_BASE_URL: readString("OPENAI_BASE_URL", ""),
	ROOT_DIR: readString("ROOT_DIR", "./分类库"),
	INCOMING_DIR: readString("INCOMING_DIR", "./待分类"),
	CRON_SCHEDULE: readString("CRON_SCHEDULE", "0 * * * *"),
	LOG_LEVEL: readString("LOG_LEVEL", "info"),
	LOG_FILE: readString("LOG_FILE", "./logs/app.log"),
	MAX_SCAN_DEPTH: readNumber("MAX_SCAN_DEPTH", 3, { min: 0 }),
	SIMILARITY_THRESHOLD: (() => {
		const raw = process.env.SIMILARITY_THRESHOLD;
		const num = raw !== undefined ? Number(raw) : 0.65;
		return Number.isFinite(num) ? num : 0.65;
	})(),
	DRY_RUN: hasArg("--dry-run"),
	RUN_ONCE: hasArg("--once"),
} as const;

export type AppConfig = typeof config;


