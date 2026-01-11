import { Task } from './task';
import { TaskResult } from './types';
import { getTaskConfig, getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { TaskUtils } from '@/lib/utils/task-utils';
import { SimilarityUtils } from '@/lib/utils/similarity-utils';
import { FileUtils } from '@/lib/utils/file-utils';
import type { ProcessedFile } from '@/lib/api-client';
import { FileScanService } from '@/lib/services/file-scan.service';
import { AIClassificationService } from '@/lib/services/ai-classification.service';
import { FileInfoService } from '@/lib/services/file-info.service';
import { FileMoveService } from '@/lib/services/file-move.service';
import { AIProcessorService } from '@/lib/services/ai-processor.service';
import { FileMoveProcessorService } from '@/lib/services/file-move-processor.service';
import { FileStatusService } from '@/lib/services/file-status.service';
import path from 'node:path';
import fs from 'node:fs';

/**
 * 任务执行器
 * 职责：执行任务的具体逻辑，更新任务状态和进度
 *
 * 注意：这里复用了原 MainService 的执行逻辑
 */
export class TaskExecutor {
  private task: Task;
  private config = getTaskConfig();
  private fullConfig = getConfig();
  private fileScanService: FileScanService;
  private aiClassificationService: AIClassificationService;
  private fileInfoService: FileInfoService;
  private fileMoveService: FileMoveService;
  private aiProcessorService: AIProcessorService;
  private fileMoveProcessorService: FileMoveProcessorService;
  private currentKnownDirs: string[] = [];

  constructor(task: Task) {
    this.task = task;
    this.fileScanService = new FileScanService();
    this.aiClassificationService = new AIClassificationService();
    this.fileInfoService = FileInfoService.getInstance();
    this.fileMoveService = new FileMoveService();
    const fileStatusService = new FileStatusService();
    this.aiProcessorService = new AIProcessorService(
      this.aiClassificationService,
      this.fileMoveService,
      fileStatusService
    );
    this.fileMoveProcessorService = new FileMoveProcessorService(this.fileMoveService);
  }

  /**
   * 执行任务
   */
  async execute(): Promise<TaskResult> {
    try {
      logger.info({ taskId: this.task.taskId, dryRun: this.task.dryRun }, '开始执行任务');

      // 阶段1：扫描文件
      this.task.updateProgress({ currentStage: 'scan' });
      const filesToProcess = await this.scanFiles();

      if (filesToProcess.length === 0) {
        logger.info({ taskId: this.task.taskId }, '没有需要处理的文件');
        this.task.complete({ stats: this.task.stats });
        return this.buildResult();
      }

      this.task.updateProgress({
        totalFiles: filesToProcess.length,
        scannedFiles: filesToProcess.length,
      });

      logger.info({ taskId: this.task.taskId, fileCount: filesToProcess.length }, '发现待处理文件');

      // 阶段2：处理文件
      this.task.updateProgress({ currentStage: 'process' });
      await this.processFiles(filesToProcess);

      // 阶段3：完成任务
      this.task.updateProgress({ currentStage: 'finalize' });
      this.task.complete({ stats: this.task.stats });

      logger.info(
        {
          taskId: this.task.taskId,
          stats: this.task.stats,
        },
        '任务执行完成'
      );

      return this.buildResult();
    } catch (error) {
      logger.error({ taskId: this.task.taskId, error }, '任务执行失败');
      throw error;
    }
  }

  /**
   * 扫描待处理文件
   */
  private async scanFiles(): Promise<string[]> {
    try {
      const { incomingDir } = this.config;

      // 解析为绝对路径
      const absoluteIncomingDir = path.resolve(process.cwd(), incomingDir);

      if (!fs.existsSync(absoluteIncomingDir)) {
        logger.warn({ incomingDir, absoluteIncomingDir }, '待处理目录不存在');
        return [];
      }

      const entries = fs.readdirSync(absoluteIncomingDir, {
        withFileTypes: true,
      });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(absoluteIncomingDir, entry.name));
    } catch (error) {
      logger.error({ error }, '扫描待处理文件失败');
      return [];
    }
  }

  /**
   * 处理文件
   */
  private async processFiles(filePaths: string[]): Promise<void> {
    // 初始化已知目录列表
    this.currentKnownDirs = this.fileScanService.scanDirs(this.config.rootDir);
    const knownFiles = this.fileScanService.scanFiles(this.config.rootDir);

    logger.info(
      {
        taskId: this.task.taskId,
        knownDirs: this.currentKnownDirs.length,
        knownFiles: knownFiles.length,
      },
      '已知目录和文件统计'
    );

    // 第一步：初始化文件记录
    await this.initializeFileRecords(filePaths);

    // 第二步：执行相似度匹配
    const { similarityResults, needAIClassification } = await this.performSimilarityMatching(
      filePaths,
      knownFiles
    );

    // 第三步：移动相似度匹配的文件
    await this.moveSimilarityMatchedFiles(similarityResults);

    // 第四步：执行 AI 分类和移动（使用 AIProcessorService）
    const aiResult = await this.performAIClassification(needAIClassification);

    // 更新最终统计
    const fileTypes: Record<string, number> = {};
    for (const file of this.task.files) {
      fileTypes[file.type] = (fileTypes[file.type] || 0) + 1;
    }

    this.task.updateStats({
      similarityMatched: similarityResults.length,
      aiClassified: aiResult.successfulMoves,
      totalProcessed: this.task.files.length,
      tokensUsed: aiResult.totalTokensUsed,
      aiCalls:
        aiResult.successfulMoves > 0
          ? Math.ceil(aiResult.successfulMoves / (this.fullConfig.ai.batch_size || 10))
          : 0,
      fileTypes,
    });
  }

  /**
   * 初始化文件记录
   */
  private async initializeFileRecords(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const ext = FileUtils.getFileExtension(fileName);
      const fileSize = this.getFileSize(filePath);

      const processedFile: ProcessedFile = {
        name: fileName,
        originalPath: filePath,
        type: ext,
        size: fileSize,
        status: 'pending',
        timestamp: Date.now(),
        processStage: 'scan',
        progress: 0,
        taskId: this.task.taskId,
      };

      this.task.addFile(processedFile);
    }

    logger.info({ taskId: this.task.taskId, fileCount: filePaths.length }, '文件记录初始化完成');
  }

  /**
   * 执行相似度匹配
   */
  private async performSimilarityMatching(
    filePaths: string[],
    knownFiles: string[]
  ): Promise<{
    similarityResults: Array<{
      fileName: string;
      filePath: string;
      bestDir: string;
      bestScore: number;
    }>;
    needAIClassification: string[];
  }> {
    logger.info({ taskId: this.task.taskId, files: filePaths.length }, '开始相似度匹配');

    const similarityResults: Array<{
      fileName: string;
      filePath: string;
      bestDir: string;
      bestScore: number;
    }> = [];
    const needAIClassification: string[] = [];

    const similarityThreshold = this.fullConfig.scan.similarity_threshold || 0.6;

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const file = this.task.files.find((f) => f.name === fileName);

      if (!file) continue;

      // 更新状态为相似度匹配中
      file.status = 'similarity_matching';
      file.processStage = 'similarity';
      file.progress = 25;

      const { bestDir, bestScore } = SimilarityUtils.findMostSimilarFile(fileName, knownFiles);

      if (bestDir && bestScore >= similarityThreshold) {
        // 相似度匹配成功
        similarityResults.push({
          fileName,
          filePath,
          bestDir,
          bestScore,
        });

        file.status = 'similarity_matched';
        file.method = 'similarity';
        file.score = bestScore;
        file.targetPath = path.join(this.config.rootDir, bestDir, fileName);
        file.progress = 50;

        logger.debug(
          {
            taskId: this.task.taskId,
            fileName,
            bestDir,
            score: bestScore.toFixed(2),
          },
          '找到相似文件'
        );
      } else {
        // 需要 AI 分类
        needAIClassification.push(filePath);
        file.method = 'ai';
        file.score = bestScore;
        file.progress = 25;
      }
    }

    logger.info(
      {
        taskId: this.task.taskId,
        similarityMatched: similarityResults.length,
        needAI: needAIClassification.length,
      },
      '相似度匹配完成'
    );

    return { similarityResults, needAIClassification };
  }

  /**
   * 移动相似度匹配的文件 - 使用 FileMoveProcessorService
   */
  private async moveSimilarityMatchedFiles(
    similarityResults: Array<{
      fileName: string;
      filePath: string;
      bestDir: string;
      bestScore: number;
    }>
  ): Promise<void> {
    if (similarityResults.length === 0) return;

    logger.info(
      { taskId: this.task.taskId, files: similarityResults.length },
      '开始移动相似度匹配的文件'
    );

    // 使用 FileMoveProcessorService 创建移动信息
    const moveInfos = FileMoveProcessorService.createMoveInfosFromSimilarity(similarityResults);

    // 批量移动文件
    await this.fileMoveProcessorService.batchMoveFiles(
      this.task.taskId,
      this.task.files,
      moveInfos,
      this.task.dryRun,
      (directoryPath) => this.updateKnownDirectories(directoryPath)
    );

    logger.info(
      { taskId: this.task.taskId, files: similarityResults.length },
      '相似度匹配文件移动完成'
    );
  }

  /**
   * 执行 AI 分类和移动 - 使用 AIProcessorService
   */
  private async performAIClassification(filePaths: string[]): Promise<{
    successfulMoves: number;
    totalTokensUsed: number;
  }> {
    if (filePaths.length === 0) {
      return { successfulMoves: 0, totalTokensUsed: 0 };
    }

    logger.info({ taskId: this.task.taskId, files: filePaths.length }, '开始 AI 分类');

    // 准备 AI 分类文件信息
    const filesWithDescription: Array<{ fileName: string; filePath: string; description: string }> =
      [];
    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const file = this.task.files.find((f) => f.name === fileName);

      if (!file) continue;

      file.status = 'ai_classifying';
      file.processStage = 'ai';
      file.progress = 50;

      const description = await this.fileInfoService.getFileDescription(filePath);
      filesWithDescription.push({ fileName, filePath, description });
    }

    // 使用 AIProcessorService 处理 AI 分类和移动
    const result = await this.aiProcessorService.processAIClassificationAndMove(
      this.task.taskId,
      this.task.files,
      filesWithDescription,
      this.currentKnownDirs,
      this.task.dryRun
    );

    logger.info(
      {
        taskId: this.task.taskId,
        successfulMoves: result.successfulMoves,
        totalTokens: result.totalTokensUsed,
      },
      'AI 分类和移动完成'
    );

    return {
      successfulMoves: result.successfulMoves,
      totalTokensUsed: result.totalTokensUsed,
    };
  }

  /**
   * 更新已知目录列表
   */
  private updateKnownDirectories(newDirPath: string): void {
    const relativeDir = path.relative(this.config.rootDir, newDirPath);
    if (relativeDir && !this.currentKnownDirs.includes(relativeDir)) {
      this.currentKnownDirs.push(relativeDir);
      logger.debug({ taskId: this.task.taskId, dir: relativeDir }, '添加新目录');
    }
  }

  /**
   * 构建任务结果
   */
  private buildResult(): TaskResult {
    return {
      taskId: this.task.taskId,
      status: this.task.status,
      duration: this.task.getDuration(),
      stats: this.task.stats,
      errorMessage: this.task.errorMessage,
    };
  }

  // ========== 辅助方法 ==========

  private getFileSize(filePath: string): string {
    try {
      const stats = fs.statSync(filePath);
      return TaskUtils.formatFileSize(stats.size);
    } catch (error) {
      logger.warn({ filePath, error }, '获取文件大小失败');
      return '0 B';
    }
  }
}
