import path from 'node:path';
import { mainLogger } from '../logger.js';
import { config } from '../config.js';
import { AIClassificationService } from './ai-classification.service.js';
import { FileMoveService } from './file-move.service.js';
import { FileInfoService } from './file-info.service.js';
import {
  FileStatusService,
  FileProcessStatus,
  FileProcessStage,
  ProcessedFile,
  FileStatusUpdate,
} from './file-status.service.js';
import { FileMoveProcessorService, FileMoveInfo } from './file-move-processor.service.js';
import { FileUtils } from '../utils/file-utils.js';

const { ROOT_DIR, AI_BATCH_SIZE } = config;

// AI分类文件接口
interface AIClassificationFile {
  fileName: string;
  filePath: string;
  description: string;
}

// AI处理结果接口
export interface AIProcessResult {
  successfulMoves: number;
  totalTokensUsed: number;
  taskStatus: 'success' | 'partial' | 'failed';
  errorMessage?: string;
}

/**
 * AI处理服务 - 专门处理AI分类相关逻辑
 */
export class AIProcessorService {
  private fileMoveProcessor: FileMoveProcessorService;

  constructor(
    private aiClassificationService: AIClassificationService,
    private fileMoveService: FileMoveService,
    private fileInfoService: FileInfoService,
    private fileStatusService: FileStatusService
  ) {
    this.fileMoveProcessor = new FileMoveProcessorService(
      this.fileMoveService,
      this.fileStatusService
    );
  }

  /**
   * 准备需要AI分类的文件
   */
  async prepareAIClassificationFiles(
    processedFiles: ProcessedFile[],
    knownFiles: string[]
  ): Promise<{
    needAIClassification: AIClassificationFile[];
    similarityUpdates: FileStatusUpdate[];
  }> {
    const needAIClassification: AIClassificationFile[] = [];
    const similarityUpdates: FileStatusUpdate[] = [];

    for (const file of processedFiles) {
      // 标记为相似度匹配中
      similarityUpdates.push({
        fileName: file.name,
        updates: {
          status: 'similarity_matching' as FileProcessStatus,
          processStage: 'similarity' as FileProcessStage,
          progress: 25,
        },
      });

      // 简单的相似度匹配逻辑（可以根据需要调整）
      const needsAI = await this.shouldUseAIClassification(file, knownFiles);

      if (needsAI) {
        const description = await this.fileInfoService.getFileDescription(file.originalPath);
        needAIClassification.push({
          fileName: file.name,
          filePath: file.originalPath,
          description,
        });

        // 更新状态，标记为需要AI分类
        similarityUpdates.push({
          fileName: file.name,
          updates: {
            status: 'pending' as FileProcessStatus,
            method: 'ai',
            progress: 25,
          },
        });
      } else {
        // 标记为跳过AI分类
        similarityUpdates.push({
          fileName: file.name,
          updates: {
            status: 'pending' as FileProcessStatus,
            method: 'similarity',
            progress: 25,
          },
        });
      }
    }

    return { needAIClassification, similarityUpdates };
  }

  /**
   * 处理AI分类请求
   */
  async processAIClassification(
    taskId: string,
    processedFiles: ProcessedFile[],
    needAIClassification: AIClassificationFile[],
    knownDirs: string[]
  ): Promise<{
    classificationResults: Array<{
      fileName: string;
      path: string;
      reasoning?: string;
    }>;
    tokensUsed: number;
  }> {
    if (needAIClassification.length === 0) {
      return { classificationResults: [], tokensUsed: 0 };
    }

    const batches = FileUtils.chunkArray(needAIClassification, AI_BATCH_SIZE);
    const startTime = Date.now();

    mainLogger.info(
      {
        taskId,
        totalFiles: needAIClassification.length,
        batchSize: AI_BATCH_SIZE,
        totalBatches: batches.length,
        knownDirs: knownDirs.length,
      },
      `开始AI分类: ${needAIClassification.length}个文件, 分为${batches.length}个批次`
    );

    let allClassificationResults: Array<{ fileName: string; path: string }> = [];
    let totalTokensUsed = 0;
    let successfulBatches = 0;
    let failedBatches = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStartTime = Date.now();

      mainLogger.info(
        {
          taskId,
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          batchSize: batch.length,
          progress: Math.round((batchIndex / batches.length) * 100),
        },
        `处理批次 ${batchIndex + 1}/${batches.length}: ${batch.length}个文件`
      );

      // 批量更新状态为"AI分类中"
      await this.fileStatusService.batchUpdateFilesToStatus(
        taskId,
        processedFiles,
        batch.map((f) => f.fileName),
        'ai_classifying',
        'ai',
        50
      );

      try {
        const { classifications: batchResults, tokensUsed } =
          await this.aiClassificationService.classifyBatch(
            batch.map((f) => ({ fileName: f.fileName, description: f.description })),
            knownDirs
          );

        const batchElapsedMs = Date.now() - batchStartTime;
        totalTokensUsed += tokensUsed;
        allClassificationResults.push(...batchResults);
        successfulBatches++;

        mainLogger.info(
          {
            taskId,
            batchIndex: batchIndex + 1,
            classified: batchResults.length,
            tokens: tokensUsed,
            elapsedMs: batchElapsedMs,
            totalClassified: allClassificationResults.length,
            totalTokens: totalTokensUsed,
          },
          `批次 ${batchIndex + 1}/${batches.length} 完成: ${batchResults.length}个文件 (耗时${batchElapsedMs}ms, ${tokensUsed} tokens)`
        );

        // 批量更新状态为"AI分类完成"
        await this.fileStatusService.batchUpdateFilesToStatus(
          taskId,
          processedFiles,
          batchResults.map((result) => result.fileName),
          'ai_classified',
          'ai',
          60
        );
      } catch (err) {
        const batchElapsedMs = Date.now() - batchStartTime;
        failedBatches++;

        mainLogger.error(
          {
            taskId,
            err,
            batchIndex: batchIndex + 1,
            totalBatches: batches.length,
            batchSize: batch.length,
            elapsedMs: batchElapsedMs,
            errorType: err instanceof Error ? err.constructor.name : 'unknown',
          },
          `批次 ${batchIndex + 1}/${batches.length} 失败: ${err instanceof Error ? err.message : String(err)} (耗时${batchElapsedMs}ms)`
        );

        // 批量更新失败状态
        await this.fileStatusService.batchUpdateFilesToStatus(
          taskId,
          processedFiles,
          batch.map((f) => f.fileName),
          'failed',
          'complete',
          100
        );
      }

      // 批次间延迟
      if (batchIndex < batches.length - 1) {
        await this.delay(1000);
      }
    }

    const totalElapsedMs = Date.now() - startTime;
    const avgMsPerFile =
      allClassificationResults.length > 0
        ? Math.round(totalElapsedMs / allClassificationResults.length)
        : 0;

    mainLogger.info(
      {
        taskId,
        totalFiles: needAIClassification.length,
        classified: allClassificationResults.length,
        failed: needAIClassification.length - allClassificationResults.length,
        successfulBatches,
        failedBatches,
        totalTokens: totalTokensUsed,
        totalElapsedMs,
        avgMsPerFile,
        successRate: Math.round(
          (allClassificationResults.length / needAIClassification.length) * 100
        ),
      },
      `AI分类完成: ${allClassificationResults.length}/${needAIClassification.length}个文件成功 (总耗时${totalElapsedMs}ms, ${totalTokensUsed} tokens, 成功率${Math.round((allClassificationResults.length / needAIClassification.length) * 100)}%)`
    );

    return { classificationResults: allClassificationResults, tokensUsed: totalTokensUsed };
  }

  /**
   * 移动AI分类的文件 - 使用统一的文件移动处理器
   */
  async moveAIClassifiedFiles(
    taskId: string,
    processedFiles: ProcessedFile[],
    classificationResults: Array<{
      fileName: string;
      path: string;
      reasoning?: string;
    }>,
    originalFiles: AIClassificationFile[],
    dryRun: boolean
  ): Promise<number> {
    if (classificationResults.length === 0) {
      return 0;
    }

    const startTime = Date.now();

    // 统计目标目录
    const targetDirs = new Set(classificationResults.map((c) => c.path));

    mainLogger.info(
      {
        taskId,
        files: classificationResults.length,
        targetDirs: targetDirs.size,
        dryRun,
        dirsPreview: Array.from(targetDirs).slice(0, 5),
      },
      `开始移动AI分类的文件: ${classificationResults.length}个文件 -> ${targetDirs.size}个目录 ${dryRun ? '(预演模式)' : ''}`
    );

    // 使用统一的文件移动处理器创建移动信息
    const originalFileInfos = originalFiles.map((f) => ({
      fileName: f.fileName,
      filePath: f.filePath,
    }));
    const moveInfos = FileMoveProcessorService.createMoveInfosFromAI(
      classificationResults,
      originalFileInfos
    );

    // 批量移动文件
    const result = await this.fileMoveProcessor.batchMoveFiles(
      taskId,
      processedFiles,
      moveInfos,
      dryRun
    );

    const elapsedMs = Date.now() - startTime;

    mainLogger.info(
      {
        taskId,
        successfulMoves: result.successfulMoves,
        totalFiles: classificationResults.length,
        failedMoves: classificationResults.length - result.successfulMoves,
        elapsedMs,
        avgMsPerFile:
          result.successfulMoves > 0 ? Math.round(elapsedMs / result.successfulMoves) : 0,
        successRate: Math.round((result.successfulMoves / classificationResults.length) * 100),
        dryRun,
      },
      `AI分类文件移动完成: ${result.successfulMoves}/${classificationResults.length}个文件成功 (耗时${elapsedMs}ms, 成功率${Math.round((result.successfulMoves / classificationResults.length) * 100)}%)`
    );

    return result.successfulMoves;
  }

  /**
   * 判断是否需要使用AI分类
   */
  private async shouldUseAIClassification(
    file: ProcessedFile,
    knownFiles: string[]
  ): Promise<boolean> {
    // 简单的判断逻辑，可以根据实际需求调整
    // 例如：如果没有找到相似的文件，则使用AI分类
    return true; // 暂时所有文件都使用AI分类
  }

  /**
   * 延迟工具方法
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 处理AI分类和文件移动 - 主要入口方法
   */
  async processAIClassificationAndMove(
    taskId: string,
    processedFiles: ProcessedFile[],
    needAIClassification: AIClassificationFile[],
    knownDirs: string[],
    dryRun: boolean
  ): Promise<AIProcessResult> {
    if (needAIClassification.length === 0) {
      mainLogger.info({ taskId }, 'AI分类流程跳过: 无需分类的文件');
      return { successfulMoves: 0, totalTokensUsed: 0, taskStatus: 'success' };
    }

    const processStartTime = Date.now();

    mainLogger.info(
      {
        taskId,
        files: needAIClassification.length,
        knownDirs: knownDirs.length,
        dryRun,
      },
      `开始AI分类和移动流程: ${needAIClassification.length}个文件 ${dryRun ? '(预演模式)' : ''}`
    );

    try {
      const classificationResults = await this.processAIClassification(
        taskId,
        processedFiles,
        needAIClassification,
        knownDirs
      );

      const successfulMoves = await this.moveAIClassifiedFiles(
        taskId,
        processedFiles,
        classificationResults.classificationResults,
        needAIClassification,
        dryRun
      );

      const totalElapsedMs = Date.now() - processStartTime;
      const taskStatus: 'success' | 'partial' | 'failed' =
        successfulMoves === needAIClassification.length
          ? 'success'
          : successfulMoves > 0
            ? 'partial'
            : 'failed';

      mainLogger.info(
        {
          taskId,
          taskStatus,
          totalFiles: needAIClassification.length,
          classified: classificationResults.classificationResults.length,
          moved: successfulMoves,
          failed: needAIClassification.length - successfulMoves,
          totalTokens: classificationResults.tokensUsed,
          totalElapsedMs,
          avgMsPerFile: successfulMoves > 0 ? Math.round(totalElapsedMs / successfulMoves) : 0,
          successRate: Math.round((successfulMoves / needAIClassification.length) * 100),
          dryRun,
        },
        `AI分类和移动流程完成: ${successfulMoves}/${needAIClassification.length}个文件成功 (总耗时${totalElapsedMs}ms, ${classificationResults.tokensUsed} tokens, 状态: ${taskStatus})`
      );

      return {
        successfulMoves,
        totalTokensUsed: classificationResults.tokensUsed,
        taskStatus,
      };
    } catch (error) {
      const totalElapsedMs = Date.now() - processStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      mainLogger.error(
        {
          taskId,
          err: error,
          errorMessage,
          errorType: error instanceof Error ? error.constructor.name : 'unknown',
          filesCount: needAIClassification.length,
          elapsedMs: totalElapsedMs,
          dryRun,
        },
        `AI分类和移动流程失败: ${errorMessage} (耗时${totalElapsedMs}ms)`
      );

      return {
        successfulMoves: 0,
        totalTokensUsed: 0,
        taskStatus: 'failed',
        errorMessage,
      };
    }
  }
}
