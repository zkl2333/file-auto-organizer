import fs from "node:fs";
import path from "node:path";
import levenshtein from "fast-levenshtein";
import cron from "node-cron";
import { logger } from "./logger.js";
import { config } from "./config.js";
import { aiClassify } from "./ai.js";
import { getFileDescription } from "./file-info.js";

const {
  OPENAI_API_KEY,
  ROOT_DIR,
  INCOMING_DIR,
  CRON_SCHEDULE,
  MAX_SCAN_DEPTH,
  SIMILARITY_THRESHOLD,
  DRY_RUN,
  RUN_ONCE,
} = config;

if (!OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY 未设置，AI 分类将无法工作");
}

// ====== 1. 扫描目录树 ======
function scanDirs(rootDir: string): string[] {
  const result: string[] = [];
  function walk(dir: string, base: string = "", depth: number = 0): void {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const relPath = path.join(base, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        result.push(relPath + "/");
        if (depth < MAX_SCAN_DEPTH) {
          walk(fullPath, relPath, depth + 1);
        }
      }
    }
  }
  if (fs.existsSync(rootDir)) {
    walk(rootDir);
  }
  return result;
}

// 递归扫描所有文件，相对 ROOT_DIR 的路径
function scanFiles(rootDir: string): string[] {
  const result: string[] = [];
  function walk(dir: string, base: string = "", depth: number = 0): void {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const relPath = path.join(base, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (depth < MAX_SCAN_DEPTH) {
          walk(fullPath, relPath, depth + 1);
        }
      } else if (stat.isFile()) {
        result.push(relPath);
      }
    }
  }
  if (fs.existsSync(rootDir)) {
    walk(rootDir);
  }
  return result;
}

// ====== 2. 最短编辑距离找相似文件 ======
function computeSimilarity(a: string, b: string): number {
  const dist = levenshtein.get(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - dist / maxLen;
}

function findMostSimilarFile(
  fileName: string,
  knownFileRelPaths: string[]
): { bestRelPath: string | null; bestDir: string | null; bestScore: number } {
  let bestRelPath: string | null = null;
  let bestDir: string | null = null;
  let bestScore = -Infinity;
  for (const rel of knownFileRelPaths) {
    const base = path.basename(rel);
    const score = computeSimilarity(fileName, base);
    if (score > bestScore) {
      bestScore = score;
      bestRelPath = rel;
      bestDir = path.dirname(rel);
    }
  }
  return { bestRelPath, bestDir, bestScore };
}

// ====== 5. 移动文件并记录日志 ======
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function moveFile(file: string, targetDir: string): void {
  const targetPath = path.join(targetDir, path.basename(file));
  if (DRY_RUN) {
    logger.info(`[dry-run] ${file} -> ${targetDir}`);
    return;
  }
  ensureDir(targetDir);
  fs.renameSync(file, targetPath);
  logger.info({ from: file, to: targetPath }, "moved");
}

// ====== 6. 定时运行任务 ======
async function runOnce(): Promise<void> {
  logger.info(`开始分类任务...${DRY_RUN ? "(dry-run)" : ""}`);

  const dirs = scanDirs(ROOT_DIR);
  const knownFiles = scanFiles(ROOT_DIR);

  if (!fs.existsSync(INCOMING_DIR)) {
    logger.warn(`待分类目录不存在: ${INCOMING_DIR}`);
    return;
  }

  const files = fs.readdirSync(INCOMING_DIR);
  for (const f of files) {
    const filePath = path.join(INCOMING_DIR, f);
    if (fs.statSync(filePath).isFile()) {
      const desc: string = await getFileDescription(filePath);

      try {
        const { bestDir, bestRelPath, bestScore } = findMostSimilarFile(
          f,
          knownFiles
        );
        if (bestDir && bestScore >= SIMILARITY_THRESHOLD) {
          const targetDir = path.join(ROOT_DIR, bestDir);
          const similarFileName = bestRelPath ? bestRelPath : "未知";
          logger.info(
            {
              file: f,
              similarFile: similarFileName,
              similarity: Number(bestScore.toFixed(4)),
              targetDir: bestDir,
            },
            "找到相似文件，使用相似度分类"
          );
          moveFile(filePath, targetDir);
          logger.info(
            {
              file: f,
              from: filePath,
              to: path.join(targetDir, path.basename(filePath)),
              method: "相似文件",
              score: Number(bestScore.toFixed(4)),
              similar: bestRelPath || undefined,
            },
            "moved"
          );
        } else {
          if (bestDir && bestScore > 0) {
            const similarFileName = bestRelPath
              ? path.basename(bestRelPath)
              : "未知";
            logger.info(
              {
                file: f,
                similarFile: similarFileName,
                similarity: Number(bestScore.toFixed(4)),
                threshold: SIMILARITY_THRESHOLD,
              },
              "相似度不足，使用 AI 分类"
            );
          }
          if (desc) {
            logger.info(`${f} -> 描述 ${desc} (ai)`);
          }
          const target = await aiClassify(f, desc, dirs);
          logger.info({ target }, "AI 分类结果");
          moveFile(filePath, path.join(ROOT_DIR, target));
          logger.info(
            {
              file: f,
              from: filePath,
              to: path.join(ROOT_DIR, target, path.basename(filePath)),
              method: "ai",
            },
            "moved"
          );
        }
      } catch (err) {
        logger.error({ err }, `处理文件失败: ${f}`);
      }
    }
  }
}

if (RUN_ONCE) {
  runOnce()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  cron.schedule(CRON_SCHEDULE, async () => {
    await runOnce();
  });
}
