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
  static getRunningStatus(): { isRunning: boolean; taskId: string | null } {
    return {
      isRunning: MainService.isRunning,
      taskId: MainService.currentTaskId,
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
      mainLogger.info({ newDir: relativeDir }, "添加新目录到已知目录列表");
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

    // 设置当前任务ID，启用任务级日志
    setCurrentTaskId(taskId);

    mainLogger.info({ taskId, dryRun }, `开始分类任务...${dryRun ? "(dry-run)" : ""}`);

    let taskStatus: 'success' | 'partial' | 'failed' = 'success';
    let errorMessage: string | undefined;

    try {

    // 统计变量
    let totalTokensUsed = 0;
    const fileTypes: Record<string, number> = {};

    // 初始化已知目录列表
    this.currentKnownDirs = this.fileScanService.scanDirs(ROOT_DIR);
    mainLogger.info({ initialDirCount: this.currentKnownDirs.length }, "初始化已知目录列表");

    const knownFiles = this.fileScanService.scanFiles(ROOT_DIR);
    const filesToProcess = this.fileScanService.getIncomingFiles(INCOMING_DIR);

    if (filesToProcess.length === 0) {
      mainLogger.info("没有需要分类的文件");

      // 清除任务状态
      setCurrentTaskId(null);
      MainService.isRunning = false;
      MainService.currentTaskId = null;

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

    mainLogger.info(`开始相似度匹配，处理 ${filesToProcess.length} 个文件`);

    for (const f of filesToProcess) {
      const filePath = path.join(INCOMING_DIR, f);
      
      // 统计文件类型
      const ext = path.extname(f).toLowerCase() || "无扩展名";
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      
      const { bestDir, bestRelPath, bestScore } = this.findMostSimilarFile(f, knownFiles);
      
      if (bestDir && bestScore >= SIMILARITY_THRESHOLD) {
        // 相似度足够，直接分类
        similarityResults.push({
          fileName: f,
          filePath,
          bestDir,
          bestScore,
          similarFile: bestRelPath
        });
        
        mainLogger.info(
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
        const description = await this.fileInfoService.getFileDescription(filePath);
        needAIClassification.push({
          fileName: f,
          filePath,
          description
        });
        
        if (bestDir && bestScore > 0) {
          mainLogger.info(
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
    let successfulMoves = 0;
    for (const result of similarityResults) {
      try {
        const targetDir = path.join(ROOT_DIR, result.bestDir!);
        await this.fileMoveService.moveFile(result.filePath, targetDir, dryRun);
        successfulMoves++;

        // 更新已知目录列表
        this.updateKnownDirectories(targetDir);

        fileMoveLogger.info(
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
        mainLogger.error({ err, fileName: result.fileName }, `相似度分类移动文件失败`);
      }
    }

    // 第三步：分批AI分类剩余文件
    let aiSuccessfulMoves = 0;
    if (needAIClassification.length > 0) {
      try {
        mainLogger.info(`开始AI分批分类，总计 ${needAIClassification.length} 个文件，批次大小: ${AI_BATCH_SIZE}`);

        // 分批处理
        const batches = this.chunkArray(needAIClassification, AI_BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          mainLogger.info(`处理第 ${batchIndex + 1}/${batches.length} 批次，包含 ${batch.length} 个文件`);
          
          try {
            // 使用当前最新的已知目录列表进行AI分类
            const { classifications: classificationResults, tokensUsed } = await this.aiClassificationService.classifyBatch(
              batch.map(f => ({ fileName: f.fileName, description: f.description })),
              this.currentKnownDirs
            );

            totalTokensUsed += tokensUsed;

            mainLogger.info(`第 ${batchIndex + 1} 批次分类完成，处理了 ${classificationResults.length} 个文件，消耗 ${tokensUsed} tokens`);

            // 处理这个批次的分类结果
            for (let i = 0; i < classificationResults.length; i++) {
              const result = classificationResults[i];
              const fileInfo = batch.find(f => f.fileName === result.fileName);
              
              if (!fileInfo) {
                mainLogger.warn(`找不到文件信息: ${result.fileName}`);
                continue;
              }

              try {
                let targetDir = result.path.trim();
                
                // 如果路径为空，使用默认目录
                if (!targetDir) {
                  targetDir = "未分类";
                  mainLogger.warn({ fileName: result.fileName }, "AI返回空路径，使用默认目录");
                }
                
                // 归一化：如果 AI 给的路径末段误含文件名，则剥离
                const givenBase = path.basename(targetDir);
                const fileBase = path.basename(fileInfo.filePath);
                const normalizedRelTargetDir = givenBase === fileBase ? path.dirname(targetDir) : targetDir;

                const fullTargetDir = path.join(ROOT_DIR, normalizedRelTargetDir);
                await this.fileMoveService.moveFile(fileInfo.filePath, fullTargetDir, dryRun);
                aiSuccessfulMoves++;

                // 更新已知目录列表
                this.updateKnownDirectories(fullTargetDir);

                fileMoveLogger.info(
                  {
                    file: result.fileName,
                    from: fileInfo.filePath,
                    to: path.join(fullTargetDir, path.basename(fileInfo.filePath)),
                    method: "ai_batch",
                    batch: `${batchIndex + 1}/${batches.length}`,
                    reasoning: result.reasoning,
                  },
                  "文件已移动"
                );
              } catch (err) {
                mainLogger.error({ err, fileName: result.fileName }, `第 ${batchIndex + 1} 批次文件移动失败`);
              }
            }
          } catch (err) {
            mainLogger.error({ err, batchIndex: batchIndex + 1, batchSize: batch.length }, `第 ${batchIndex + 1} 批次AI分类失败`);
            // 继续处理下一批次，不中断整个流程
          }

          // 批次间稍作延迟，避免API请求过于频繁
          if (batchIndex < batches.length - 1) {
            mainLogger.info(`批次间等待 1 秒...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        mainLogger.info(`AI分批分类完成，总计处理 ${aiSuccessfulMoves}/${needAIClassification.length} 个文件`);
      } catch (err) {
        mainLogger.error({ err }, `AI分批分类过程失败`);
        taskStatus = 'failed';
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    const duration = Date.now() - startTime;
    const totalProcessed = successfulMoves + aiSuccessfulMoves;

    mainLogger.info(`分类任务完成 - 相似度匹配: ${similarityResults.length} 个, AI分类: ${needAIClassification.length} 个, Token消耗: ${totalTokensUsed}`);

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
      // 捕获整个任务执行的错误
      mainLogger.error({ error, taskId }, "任务执行发生严重错误");
      flushLogs();

      // 清除任务状态
      setCurrentTaskId(null);
      MainService.isRunning = false;
      MainService.currentTaskId = null;

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
