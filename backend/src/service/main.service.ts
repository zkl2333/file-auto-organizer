import path from "node:path";
import { randomBytes } from "node:crypto";
import levenshtein from "fast-levenshtein";
import { mainLogger, fileMoveLogger, flushLogs, setCurrentTaskId } from "../logger.js";
import { config } from "../config.js";
import { FileScanService } from "./file-scan.service.js";
import { FileMoveService } from "./file-move.service.js";
import { AIClassificationService } from "./ai-classification.service.js";
import { FileInfoService } from "./file-info.service.js";

const {
  ROOT_DIR,
  INCOMING_DIR,
  SIMILARITY_THRESHOLD,
  AI_BATCH_SIZE,
} = config;

export class MainService {
  // 静态锁，确保同一时间只有一个任务在运行
  private static isRunning = false;
  private static currentTaskId: string | null = null;
  private static currentTaskStartTime: number | null = null;
  private static currentTaskDryRun: boolean = false;

  private fileScanService: FileScanService;
  private fileMoveService: FileMoveService;
  private aiClassificationService: AIClassificationService;
  private fileInfoService: FileInfoService;
  private currentKnownDirs: string[] = []; // 动态维护的已知目录列表

  constructor() {
    this.fileScanService = new FileScanService();
    this.fileMoveService = new FileMoveService();
    this.aiClassificationService = new AIClassificationService();
    this.fileInfoService = new FileInfoService();
  }

  /**
   * 检查是否有任务正在运行
   */
  static getRunningStatus(): { 
    isRunning: boolean; 
    taskId: string | null;
    startTime: number | null;
    dryRun: boolean;
  } {
    return {
      isRunning: MainService.isRunning,
      taskId: MainService.currentTaskId,
      startTime: MainService.currentTaskStartTime,
      dryRun: MainService.currentTaskDryRun,
    };
  }

  /**
   * 计算两个文件的相似度
   */
  private computeSimilarity(a: string, b: string): number {
    const dist = levenshtein.get(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length) || 1;
    return 1 - dist / maxLen;
  }

  /**
   * 找到最相似的文件
   */
  private findMostSimilarFile(
    fileName: string,
    knownFileRelPaths: string[]
  ): { bestRelPath: string | null; bestDir: string | null; bestScore: number } {
    let bestRelPath: string | null = null;
    let bestDir: string | null = null;
    let bestScore = -Infinity;
    
    for (const rel of knownFileRelPaths) {
      const base = path.basename(rel);
      const score = this.computeSimilarity(fileName, base);
      if (score > bestScore) {
        bestScore = score;
        bestRelPath = rel;
        bestDir = path.dirname(rel);
      }
    }
    
    return { bestRelPath, bestDir, bestScore };
  }

  /**
   * 更新已知目录列表，添加新创建的目录
   */
  private updateKnownDirectories(newDirPath: string): void {
    const relativeDir = path.relative(ROOT_DIR, newDirPath);
    if (relativeDir && !this.currentKnownDirs.includes(relativeDir)) {
      this.currentKnownDirs.push(relativeDir);
      mainLogger.debug({ dir: relativeDir }, "添加新目录");
    }
  }

  /**
   * 分批处理工具函数
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const random = randomBytes(4).toString('hex');
    return `task-${timestamp}-${random}`;
  }

  /**
   * 执行一次完整的分类任务
   */
  async runOnce(dryRun: boolean = false): Promise<{
    taskId: string;
    similarityMatched: number;
    aiClassified: number;
    totalProcessed: number;
    duration: number;
    tokensUsed: number;
    fileTypes: Record<string, number>;
    status: 'success' | 'partial' | 'failed';
    errorMessage?: string;
  }> {
    // 检查是否有任务正在运行
    if (MainService.isRunning) {
      const errorMsg = `任务正在执行中（任务ID: ${MainService.currentTaskId}），请稍候`;
      mainLogger.warn({ currentTaskId: MainService.currentTaskId }, errorMsg);

      return {
        taskId: '',
        similarityMatched: 0,
        aiClassified: 0,
        totalProcessed: 0,
        duration: 0,
        tokensUsed: 0,
        fileTypes: {},
        status: 'failed',
        errorMessage: errorMsg,
      };
    }

    const taskId = this.generateTaskId();
    const startTime = Date.now();

    // 设置运行状态
    MainService.isRunning = true;
    MainService.currentTaskId = taskId;
    MainService.currentTaskStartTime = startTime;
    MainService.currentTaskDryRun = dryRun;

    // 设置当前任务ID，启用任务级日志
    setCurrentTaskId(taskId);

    mainLogger.info({ taskId, dryRun }, "任务开始");

    let taskStatus: 'success' | 'partial' | 'failed' = 'success';
    let errorMessage: string | undefined;

    try {

    // 统计变量
    let totalTokensUsed = 0;
    const fileTypes: Record<string, number> = {};

    // 初始化已知目录列表
    this.currentKnownDirs = this.fileScanService.scanDirs(ROOT_DIR);

    const knownFiles = this.fileScanService.scanFiles(ROOT_DIR);
    const filesToProcess = this.fileScanService.getIncomingFiles(INCOMING_DIR);

    if (filesToProcess.length === 0) {
      mainLogger.info({ taskId }, "没有需要处理的文件");

      // 清除任务状态
      setCurrentTaskId(null);
      MainService.isRunning = false;
      MainService.currentTaskId = null;
      MainService.currentTaskStartTime = null;
      MainService.currentTaskDryRun = false;

      return {
        taskId,
        similarityMatched: 0,
        aiClassified: 0,
        totalProcessed: 0,
        duration: Date.now() - startTime,
        tokensUsed: 0,
        fileTypes: {},
        status: 'success',
      };
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

    mainLogger.info({ files: filesToProcess.length }, "开始相似度匹配");

    for (const f of filesToProcess) {
      const filePath = path.join(INCOMING_DIR, f);
      
      // 统计文件类型
      const ext = path.extname(f).toLowerCase() || "无扩展名";
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      
      const { bestDir, bestRelPath, bestScore } = this.findMostSimilarFile(f, knownFiles);
      
      if (bestDir && bestScore >= SIMILARITY_THRESHOLD) {
        similarityResults.push({
          fileName: f,
          filePath,
          bestDir,
          bestScore,
          similarFile: bestRelPath
        });
        
        mainLogger.debug(
          { file: f, similar: bestRelPath ? path.basename(bestRelPath) : null, score: bestScore.toFixed(2) },
          "找到相似文件"
        );
      } else {
        const description = await this.fileInfoService.getFileDescription(filePath);
        needAIClassification.push({
          fileName: f,
          filePath,
          description
        });
      }
    }

    // 第二步：处理相似度匹配的文件
    let successfulMoves = 0;
    for (const result of similarityResults) {
      try {
        const targetDir = path.join(ROOT_DIR, result.bestDir!);
        await this.fileMoveService.moveFile(result.filePath, targetDir, dryRun);
        successfulMoves++;
        this.updateKnownDirectories(targetDir);

        fileMoveLogger.info(
          { file: result.fileName, to: result.bestDir, method: "similarity", score: result.bestScore.toFixed(2) },
          "文件已移动"
        );
      } catch (err) {
        mainLogger.error({ err, file: result.fileName }, "相似度匹配移动失败");
      }
    }

    // 第三步：分批AI分类剩余文件
    let aiSuccessfulMoves = 0;
    if (needAIClassification.length > 0) {
      try {
        const batches = this.chunkArray(needAIClassification, AI_BATCH_SIZE);
        mainLogger.info({ files: needAIClassification.length, batches: batches.length }, "开始 AI 分类");

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          try {
            const { classifications: classificationResults, tokensUsed } = await this.aiClassificationService.classifyBatch(
              batch.map(f => ({ fileName: f.fileName, description: f.description })),
              this.currentKnownDirs
            );

            totalTokensUsed += tokensUsed;

            for (const result of classificationResults) {
              const fileInfo = batch.find(f => f.fileName === result.fileName);
              
              if (!fileInfo) {
                mainLogger.warn({ file: result.fileName }, "找不到文件信息");
                continue;
              }

              try {
                let targetDir = result.path.trim() || "未分类";
                
                const givenBase = path.basename(targetDir);
                const fileBase = path.basename(fileInfo.filePath);
                const normalizedRelTargetDir = givenBase === fileBase ? path.dirname(targetDir) : targetDir;

                const fullTargetDir = path.join(ROOT_DIR, normalizedRelTargetDir);
                await this.fileMoveService.moveFile(fileInfo.filePath, fullTargetDir, dryRun);
                aiSuccessfulMoves++;
                this.updateKnownDirectories(fullTargetDir);

                fileMoveLogger.info(
                  { file: result.fileName, to: normalizedRelTargetDir, method: "ai" },
                  "文件已移动"
                );
              } catch (err) {
                mainLogger.error({ err, file: result.fileName }, "AI 分类移动失败");
              }
            }
          } catch (err) {
            mainLogger.error({ err, batch: batchIndex + 1 }, "AI 批次分类失败");
          }

          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (err) {
        mainLogger.error({ err }, "AI 分类过程失败");
        taskStatus = 'failed';
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    const duration = Date.now() - startTime;
    const totalProcessed = successfulMoves + aiSuccessfulMoves;

    mainLogger.info(
      { taskId, similarity: successfulMoves, ai: aiSuccessfulMoves, tokens: totalTokensUsed, duration },
      "任务完成"
    );

    // 确保所有日志都写入文件
    flushLogs();

    // 清除任务状态
    setCurrentTaskId(null);
    MainService.isRunning = false;
    MainService.currentTaskId = null;

    return {
      taskId,
      similarityMatched: similarityResults.length,
      aiClassified: needAIClassification.length,
      totalProcessed,
      duration,
      tokensUsed: totalTokensUsed,
      fileTypes,
      status: taskStatus,
      errorMessage,
    };
    } catch (error) {
      mainLogger.error({ err: error, taskId }, "任务执行失败");
      flushLogs();

      // 清除任务状态
      setCurrentTaskId(null);
      MainService.isRunning = false;
      MainService.currentTaskId = null;
      MainService.currentTaskStartTime = null;
      MainService.currentTaskDryRun = false;

      return {
        taskId,
        similarityMatched: 0,
        aiClassified: 0,
        totalProcessed: 0,
        duration: Date.now() - startTime,
        tokensUsed: 0,
        fileTypes: {},
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
