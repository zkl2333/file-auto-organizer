import fs from "node:fs";
import path from "node:path";
import levenshtein from "fast-levenshtein";
import cron from "node-cron";
import { logger } from "./logger.js";
import { config } from "./config.js";
import { aiClassifyBatch } from "./ai.js";
import { getFileDescription } from "./file-info.js";

const {
  OPENAI_API_KEY,
  ROOT_DIR,
  INCOMING_DIR,
  CRON_SCHEDULE,
  MAX_SCAN_DEPTH,
  SIMILARITY_THRESHOLD,
  AI_BATCH_SIZE,
  FILE_MAX_RETRIES,
  FILE_RETRY_DELAY_BASE,
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

// ====== 分批处理工具函数 ======
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// ====== 3. 移动文件并记录日志 ======
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function moveFile(file: string, targetDir: string): Promise<void> {
  const targetPath = path.join(targetDir, path.basename(file));

  if (DRY_RUN) {
    logger.info(`[dry-run] ${file} -> ${targetDir}`);
    return;
  }

  ensureDir(targetDir);

  for (let attempt = 1; attempt <= FILE_MAX_RETRIES; attempt++) {
    try {
      // 检查目标文件是否已存在
      if (fs.existsSync(targetPath)) {
        const ext = path.extname(file);
        const name = path.basename(file, ext);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const newName = `${name}_${timestamp}${ext}`;
        const newTargetPath = path.join(targetDir, newName);
        fs.renameSync(file, newTargetPath);
        logger.info({ from: file, to: newTargetPath }, "文件已移动（因冲突重命名）");
        return;
      }

      fs.renameSync(file, targetPath);
      logger.info({ from: file, to: targetPath }, "文件已移动");
      return;
    } catch (err: any) {
      if (err.code === "EBUSY" || err.code === "EACCES" || err.code === "EPERM") {
        if (attempt < FILE_MAX_RETRIES) {
          const delay = FILE_RETRY_DELAY_BASE * Math.pow(2, attempt - 1); // 指数退避
          logger.warn(
            {
              file,
              attempt,
              maxRetries: FILE_MAX_RETRIES,
              delay,
              error: err.message,
            },
            "文件被占用，等待重试"
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        } else {
          logger.error(
            {
              file,
              targetPath,
              error: err.message,
              attempts: FILE_MAX_RETRIES,
            },
            "文件移动失败，已达到最大重试次数"
          );
          throw err;
        }
      } else {
        // 其他错误直接抛出
        logger.error({ file, targetPath, error: err.message }, "文件移动失败");
        throw err;
      }
    }
  }
}

// ====== 4. 批量文件分类处理 ======
async function runOnce(): Promise<void> {
  logger.info(`开始分类任务...${DRY_RUN ? "(dry-run)" : ""}`);

  const dirs = scanDirs(ROOT_DIR);
  const knownFiles = scanFiles(ROOT_DIR);

  if (!fs.existsSync(INCOMING_DIR)) {
    logger.warn(`待分类目录不存在: ${INCOMING_DIR}`);
    return;
  }

  const files = fs.readdirSync(INCOMING_DIR);
  const filesToProcess = files.filter(f => fs.statSync(path.join(INCOMING_DIR, f)).isFile());

  if (filesToProcess.length === 0) {
    logger.info("没有需要分类的文件");
    return;
  }

  // 第一步：相似度匹配
  const similarityResults: Array<{
    fileName: string;
    filePath: string;
    bestDir: string | null;
    bestScore: number;
    similarFile: string | null;
  }> = [];

  const needAIClassification: Array<{
    fileName: string;
    filePath: string;
    description: string;
  }> = [];

  logger.info(`开始相似度匹配，处理 ${filesToProcess.length} 个文件`);

  for (const f of filesToProcess) {
    const filePath = path.join(INCOMING_DIR, f);
    const { bestDir, bestRelPath, bestScore } = findMostSimilarFile(f, knownFiles);
    
    if (bestDir && bestScore >= SIMILARITY_THRESHOLD) {
      // 相似度足够，直接分类
      similarityResults.push({
        fileName: f,
        filePath,
        bestDir,
        bestScore,
        similarFile: bestRelPath
      });
      
      logger.info(
        {
          file: f,
          similarFile: bestRelPath ? path.basename(bestRelPath) : "未知",
          similarity: Number(bestScore.toFixed(4)),
          targetDir: bestDir,
        },
        "找到相似文件，使用相似度分类"
      );
    } else {
      // 相似度不足，需要AI分类
      const description = await getFileDescription(filePath);
      needAIClassification.push({
        fileName: f,
        filePath,
        description
      });
      
      if (bestDir && bestScore > 0) {
        logger.info(
          {
            file: f,
            similarFile: bestRelPath ? path.basename(bestRelPath) : "未知",
            similarity: Number(bestScore.toFixed(4)),
            threshold: SIMILARITY_THRESHOLD,
          },
          "相似度不足，将使用 AI 分类"
        );
      }
    }
  }

  // 第二步：处理相似度匹配的文件
  for (const result of similarityResults) {
    try {
      const targetDir = path.join(ROOT_DIR, result.bestDir!);
      await moveFile(result.filePath, targetDir);
      
      logger.info(
        {
          file: result.fileName,
          from: result.filePath,
          to: path.join(targetDir, path.basename(result.filePath)),
          method: "相似文件",
          score: Number(result.bestScore.toFixed(4)),
          similar: result.similarFile || undefined,
        },
        "文件已移动"
      );
    } catch (err) {
      logger.error({ err, fileName: result.fileName }, `相似度分类移动文件失败`);
    }
  }

  // 第三步：分批AI分类剩余文件
  if (needAIClassification.length > 0) {
    try {
      logger.info(`开始AI分批分类，总计 ${needAIClassification.length} 个文件，批次大小: ${AI_BATCH_SIZE}`);
      
      // 分批处理
      const batches = chunkArray(needAIClassification, AI_BATCH_SIZE);
      let totalProcessed = 0;
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        logger.info(`处理第 ${batchIndex + 1}/${batches.length} 批次，包含 ${batch.length} 个文件`);
        
        try {
          const classificationResults = await aiClassifyBatch(
            batch.map(f => ({ fileName: f.fileName, description: f.description })),
            dirs
          );

          logger.info(`第 ${batchIndex + 1} 批次分类完成，处理了 ${classificationResults.length} 个文件`);

          // 处理这个批次的分类结果
          for (let i = 0; i < classificationResults.length; i++) {
            const result = classificationResults[i];
            const fileInfo = batch.find(f => f.fileName === result.fileName);
            
            if (!fileInfo) {
              logger.warn(`找不到文件信息: ${result.fileName}`);
              continue;
            }

            try {
              let targetDir = result.path.trim();
              
              // 如果路径为空，使用默认目录
              if (!targetDir) {
                targetDir = "未分类";
                logger.warn({ fileName: result.fileName }, "AI返回空路径，使用默认目录");
              }
              
              const fullTargetDir = path.join(ROOT_DIR, targetDir);
              await moveFile(fileInfo.filePath, fullTargetDir);
              
              logger.info(
                {
                  file: result.fileName,
                  from: fileInfo.filePath,
                  to: path.join(fullTargetDir, path.basename(fileInfo.filePath)),
                  method: "ai_batch",
                  batch: `${batchIndex + 1}/${batches.length}`,
                  confidence: result.confidence,
                  reasoning: result.reasoning,
                },
                "文件已移动"
              );
              totalProcessed++;
            } catch (err) {
              logger.error({ err, fileName: result.fileName }, `第 ${batchIndex + 1} 批次文件移动失败`);
            }
          }
        } catch (err) {
          logger.error({ err, batchIndex: batchIndex + 1, batchSize: batch.length }, `第 ${batchIndex + 1} 批次AI分类失败`);
          // 继续处理下一批次，不中断整个流程
        }
        
        // 批次间稍作延迟，避免API请求过于频繁
        if (batchIndex < batches.length - 1) {
          logger.info(`批次间等待 1 秒...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      logger.info(`AI分批分类完成，总计处理 ${totalProcessed}/${needAIClassification.length} 个文件`);
    } catch (err) {
      logger.error({ err }, `AI分批分类过程失败`);
      throw err;
    }
  }

  logger.info(`分类任务完成 - 相似度匹配: ${similarityResults.length} 个, AI分类: ${needAIClassification.length} 个`);
}

if (RUN_ONCE) {
  runOnce()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  // 设置环境变量避免时区问题
  process.env.TZ = process.env.TZ || 'Asia/Shanghai';
  
  try {
    logger.info(`正在启动定时任务，计划表达式: ${CRON_SCHEDULE}, 时区: ${process.env.TZ}`);
    
    // 验证 cron 表达式
    if (!cron.validate(CRON_SCHEDULE)) {
      throw new Error(
        `无效的 cron 表达式: ${CRON_SCHEDULE}\n` +
        `node-cron 使用标准 Unix cron 格式（5个字段）：分 时 日 月 星期\n` +
        `示例：\n` +
        `  "*/5 * * * *" - 每5分钟\n` +
        `  "0 * * * *"   - 每小时\n` +
        `  "0 0 * * *"   - 每天\n` +
        `请勿使用 Quartz 格式（6个字段，包含秒）`
      );
    }
    
    const task = cron.schedule(CRON_SCHEDULE, async () => {
      try {
        logger.info("定时任务开始执行");
        await runOnce();
        logger.info("定时任务执行完成");
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, "定时任务执行失败");
      }
    }, {
      timezone: process.env.TZ
    });
    
    logger.info("定时任务已启动，等待执行...");
    
    // 添加进程退出处理
    process.on('SIGINT', () => {
      logger.info('收到 SIGINT 信号，正在停止定时任务...');
      task.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('收到 SIGTERM 信号，正在停止定时任务...');
      task.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      cronSchedule: CRON_SCHEDULE,
      timezone: process.env.TZ
    }, "定时任务启动失败");
    
    // 如果定时任务启动失败，尝试运行一次后退出
    logger.info("定时任务启动失败，尝试执行一次后退出");
    try {
      await runOnce();
      process.exit(0);
    } catch (runError) {
      logger.error({ error: runError instanceof Error ? runError.message : String(runError) }, "单次执行也失败");
      process.exit(1);
    }
  }
}
