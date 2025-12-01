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
import path from 'node:path';
import fs from 'node:fs';

/** 分类结果 */
interface ClassifiedFile {
  fileName: string;
  filePath: string;
  targetDir: string;
  reasoning?: string;
}

/**
 * 任务执行器
 * 负责执行文件分类任务：扫描 -> 相似度匹配 -> AI分类 -> 移动文件
 */
export class TaskExecutor {
  private task: Task;
  private config = getTaskConfig();
  private fullConfig = getConfig();
  private fileScanService: FileScanService;
  private aiClassificationService: AIClassificationService;
  private fileInfoService: FileInfoService;
  private fileMoveService: FileMoveService;
  private currentKnownDirs: string[] = [];
  private fileMap = new Map<string, ProcessedFile>();

  constructor(task: Task) {
    this.task = task;
    this.fileScanService = new FileScanService();
    this.aiClassificationService = new AIClassificationService();
    this.fileInfoService = FileInfoService.getInstance();
    this.fileMoveService = new FileMoveService();
  }

  /** 执行任务，返回任务结果 */
  async execute(): Promise<TaskResult> {
    try {
      logger.info({ taskId: this.task.taskId, dryRun: this.task.dryRun }, '开始执行任务');

      this.task.updateProgress({ currentStage: 'scan' });
      const filesToProcess = this.scanFiles();

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

      this.task.updateProgress({ currentStage: 'process' });
      await this.processFiles(filesToProcess);

      this.task.updateProgress({ currentStage: 'finalize' });
      this.task.complete({ stats: this.task.stats });

      logger.info({ taskId: this.task.taskId, stats: this.task.stats }, '任务执行完成');

      return this.buildResult();
    } catch (error) {
      logger.error({ taskId: this.task.taskId, error }, '任务执行失败');
      throw error;
    }
  }

  /** 扫描待处理目录，返回文件路径列表 */
  private scanFiles(): string[] {
    try {
      const absoluteIncomingDir = path.resolve(process.cwd(), this.config.incomingDir);

      if (!fs.existsSync(absoluteIncomingDir)) {
        logger.warn({ dir: absoluteIncomingDir }, '待处理目录不存在');
        return [];
      }

      return fs
        .readdirSync(absoluteIncomingDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(absoluteIncomingDir, entry.name));
    } catch (error) {
      logger.error({ error }, '扫描待处理文件失败');
      return [];
    }
  }

  /** 处理文件：相似度匹配 -> AI分类 -> 移动 */
  private async processFiles(filePaths: string[]): Promise<void> {
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

    this.initializeFileRecords(filePaths);

    const { matched, needAI } = this.performSimilarityMatching(filePaths, knownFiles);

    await this.moveFiles(matched);

    const { aiResults, tokensUsed } = await this.performAIClassification(needAI);

    await this.moveFiles(aiResults);

    this.updateFinalStats(matched.length, aiResults.length, tokensUsed);
  }

  /** 初始化文件记录并建立 fileMap 索引 */
  private initializeFileRecords(filePaths: string[]): void {
    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const processedFile: ProcessedFile = {
        name: fileName,
        originalPath: filePath,
        type: FileUtils.getFileExtension(fileName),
        size: this.getFileSize(filePath),
        status: 'pending',
        timestamp: Date.now(),
        processStage: 'scan',
        progress: 0,
        taskId: this.task.taskId,
      };

      this.task.addFile(processedFile);
      this.fileMap.set(fileName, processedFile);
    }

    logger.info({ taskId: this.task.taskId, fileCount: filePaths.length }, '文件记录初始化完成');
  }

  /** 相似度匹配，返回匹配成功的文件和需要AI分类的文件 */
  private performSimilarityMatching(
    filePaths: string[],
    knownFiles: string[]
  ): { matched: ClassifiedFile[]; needAI: string[] } {
    logger.info({ taskId: this.task.taskId, files: filePaths.length }, '开始相似度匹配');

    const matched: ClassifiedFile[] = [];
    const needAI: string[] = [];
    const threshold = this.fullConfig.scan.similarity_threshold || 0.6;

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const file = this.fileMap.get(fileName);
      if (!file) continue;

      file.status = 'similarity_matching';
      file.processStage = 'similarity';
      file.progress = 25;

      const { bestDir, bestScore } = SimilarityUtils.findMostSimilarFile(fileName, knownFiles);

      if (bestDir && bestScore >= threshold) {
        matched.push({ fileName, filePath, targetDir: bestDir });

        file.status = 'similarity_matched';
        file.method = 'similarity';
        file.score = bestScore;
        file.targetPath = path.join(this.config.rootDir, bestDir, fileName);
        file.progress = 50;

        this.updateKnownDirectories(path.join(this.config.rootDir, bestDir));

        logger.debug(
          { taskId: this.task.taskId, fileName, bestDir, score: bestScore.toFixed(2) },
          '找到相似文件'
        );
      } else {
        needAI.push(filePath);
        file.method = 'ai';
        file.score = bestScore;
        file.progress = 25;
      }
    }

    logger.info(
      { taskId: this.task.taskId, matched: matched.length, needAI: needAI.length },
      '相似度匹配完成'
    );

    return { matched, needAI };
  }

  /** 移动文件到目标目录，dryRun 模式下只更新状态 */
  private async moveFiles(files: ClassifiedFile[]): Promise<void> {
    if (files.length === 0) return;

    logger.info({ taskId: this.task.taskId, files: files.length }, '开始移动文件');

    for (const { fileName, filePath, targetDir } of files) {
      const file = this.fileMap.get(fileName);
      if (!file) continue;

      const targetPath = path.join(this.config.rootDir, targetDir, fileName);

      if (this.task.dryRun) {
        Object.assign(file, {
          status: 'success',
          processStage: 'complete',
          progress: 100,
          targetPath,
        });
      } else {
        file.status = 'moving';
        file.processStage = 'move';
        file.progress = 75;

        const result = await this.fileMoveService.moveFile(filePath, targetPath);

        if (result.success) {
          Object.assign(file, {
            status: 'success',
            targetPath: result.finalPath,
            progress: 100,
            processStage: 'complete',
          });
        } else {
          Object.assign(file, { status: 'failed', progress: 100, processStage: 'complete' });
          logger.error({ taskId: this.task.taskId, fileName, error: result.error }, '文件移动失败');
        }
      }
    }

    logger.info({ taskId: this.task.taskId, files: files.length }, '文件移动完成');
  }

  /** AI 分类：获取文件描述 -> 批量调用AI -> 处理结果 */
  private async performAIClassification(
    filePaths: string[]
  ): Promise<{ aiResults: ClassifiedFile[]; tokensUsed: number }> {
    if (filePaths.length === 0) return { aiResults: [], tokensUsed: 0 };

    logger.info({ taskId: this.task.taskId, files: filePaths.length }, '开始 AI 分类');

    const filesWithDesc = await this.prepareFileDescriptions(filePaths);

    try {
      const { classifications, tokensUsed } = await this.classifyInBatches(filesWithDesc);
      const aiResults = this.processClassificationResults(classifications, filesWithDesc);

      logger.info(
        { taskId: this.task.taskId, classified: aiResults.length, tokensUsed },
        'AI 分类完成'
      );

      return { aiResults, tokensUsed };
    } catch (error) {
      logger.error({ taskId: this.task.taskId, error }, 'AI 分类失败');
      this.markFilesAsFailed(filePaths);
      return { aiResults: [], tokensUsed: 0 };
    }
  }

  /** 获取文件描述信息用于AI分类 */
  private async prepareFileDescriptions(
    filePaths: string[]
  ): Promise<Array<{ fileName: string; description: string; filePath: string }>> {
    const result: Array<{ fileName: string; description: string; filePath: string }> = [];

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const file = this.fileMap.get(fileName);

      if (file) {
        file.status = 'ai_classifying';
        file.processStage = 'ai';
        file.progress = 50;
      }

      const description = await this.fileInfoService.getFileDescription(filePath);
      logger.info({ taskId: this.task.taskId, fileName, description }, '获取文件描述');

      if (file) {
        file.description = description;
      }

      result.push({ fileName, description, filePath });
    }

    return result;
  }

  /** 分批调用AI分类服务，批次间更新已知目录并延迟1秒 */
  private async classifyInBatches(
    filesWithDesc: Array<{ fileName: string; description: string }>
  ): Promise<{
    classifications: Array<{ fileName: string; path: string; reasoning?: string }>;
    tokensUsed: number;
  }> {
    const batchSize = this.fullConfig.ai.batch_size || 10;
    const batches = FileUtils.chunkArray(filesWithDesc, batchSize);

    const allClassifications: Array<{ fileName: string; path: string; reasoning?: string }> = [];
    let totalTokensUsed = 0;

    for (let i = 0; i < batches.length; i++) {
      logger.info(
        {
          taskId: this.task.taskId,
          batch: `${i + 1}/${batches.length}`,
          knownDirs: this.currentKnownDirs.length,
        },
        '处理 AI 分类批次'
      );

      const { classifications, tokensUsed } = await this.aiClassificationService.classifyBatch(
        batches[i].map((f) => ({ fileName: f.fileName, description: f.description })),
        this.currentKnownDirs
      );

      // 批次完成后立即更新已知目录，供下一批次参考
      for (const { path: targetDir } of classifications) {
        this.updateKnownDirectories(path.join(this.config.rootDir, targetDir));
      }

      allClassifications.push(...classifications);
      totalTokensUsed += tokensUsed;

      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { classifications: allClassifications, tokensUsed: totalTokensUsed };
  }

  /** 处理AI分类结果，更新文件状态 */
  private processClassificationResults(
    classifications: Array<{ fileName: string; path: string; reasoning?: string }>,
    filesWithDesc: Array<{ fileName: string; filePath: string }>
  ): ClassifiedFile[] {
    const results: ClassifiedFile[] = [];
    const filePathMap = new Map(filesWithDesc.map((f) => [f.fileName, f.filePath]));

    for (const { fileName, path: targetDir, reasoning } of classifications) {
      const filePath = filePathMap.get(fileName);
      if (!filePath) continue;

      const file = this.fileMap.get(fileName);
      if (file) {
        file.status = 'ai_classified';
        file.progress = 60;
        file.reasoning = reasoning;
      }

      results.push({ fileName, filePath, targetDir, reasoning });
    }

    return results;
  }

  private markFilesAsFailed(filePaths: string[]): void {
    for (const filePath of filePaths) {
      const file = this.fileMap.get(path.basename(filePath));
      if (file) {
        Object.assign(file, { status: 'failed', progress: 100, processStage: 'complete' });
      }
    }
  }

  /** 更新已知目录列表，用于后续AI分类参考 */
  private updateKnownDirectories(newDirPath: string): void {
    const relativeDir = path.relative(this.config.rootDir, newDirPath);
    if (relativeDir && !this.currentKnownDirs.includes(relativeDir)) {
      this.currentKnownDirs.push(relativeDir);
      logger.debug({ taskId: this.task.taskId, dir: relativeDir }, '添加新目录');
    }
  }

  private updateFinalStats(
    similarityMatched: number,
    aiClassified: number,
    tokensUsed: number
  ): void {
    const fileTypes: Record<string, number> = {};
    for (const file of this.task.files) {
      fileTypes[file.type] = (fileTypes[file.type] || 0) + 1;
    }

    this.task.updateStats({
      similarityMatched,
      aiClassified,
      totalProcessed: this.task.files.length,
      tokensUsed,
      aiCalls:
        aiClassified > 0 ? Math.ceil(aiClassified / (this.fullConfig.ai.batch_size || 10)) : 0,
      fileTypes,
    });
  }

  private buildResult(): TaskResult {
    return {
      taskId: this.task.taskId,
      status: this.task.status,
      duration: this.task.getDuration(),
      stats: this.task.stats,
      errorMessage: this.task.errorMessage,
    };
  }

  private getFileSize(filePath: string): string {
    try {
      return TaskUtils.formatFileSize(fs.statSync(filePath).size);
    } catch {
      return '0 B';
    }
  }
}
