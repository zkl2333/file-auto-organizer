import path from 'node:path';
import { mainLogger, fileMoveLogger, flushLogs, setCurrentTaskId } from '../logger.js';
import { config } from '../config.js';
import { FileScanService } from './file-scan.service.js';
import { FileMoveService } from './file-move.service.js';
import { AIClassificationService } from './ai-classification.service.js';
import { FileInfoService } from './file-info.service.js';
import { FileStatusService, ProcessedFile } from './file-status.service.js';
import { AIProcessorService, AIProcessResult } from './ai-processor.service.js';
import { FileMoveProcessorService } from './file-move-processor.service.js';
import { SimilarityUtils } from '../utils/similarity-utils.js';
import { TaskUtils } from '../utils/task-utils.js';
import { FileUtils } from '../utils/file-utils.js';

// 重新导出类型，保持兼容性
export type { ProcessedFile, FileProcessStatus, FileProcessStage } from './file-status.service.js';

const { ROOT_DIR, INCOMING_DIR, SIMILARITY_THRESHOLD } = config;

/**
 * 主服务类 - 重构版本
 * 职责：任务流程编排和协调
 */
export class MainService {
  // 静态锁，确保同一时间只有一个任务在运行
  private static isRunning = false;
  private static currentTaskId: string | null = null;
  private static currentTaskStartTime: number | null = null;
  private static currentTaskDryRun: boolean = false;

  private fileScanService: FileScanService;
  private fileMoveService: FileMoveService;
  private fileStatusService: FileStatusService;
  private aiProcessorService: AIProcessorService;
  private fileMoveProcessor: FileMoveProcessorService;
  private currentKnownDirs: string[] = []; // 动态维护的已知目录列表

  constructor() {
    this.fileScanService = new FileScanService();
    this.fileMoveService = new FileMoveService();
    this.fileStatusService = new FileStatusService();
    this.fileMoveProcessor = new FileMoveProcessorService(
      this.fileMoveService,
      this.fileStatusService
    );

    // 初始化AI处理器服务
    const aiClassificationService = new AIClassificationService();
    const fileInfoService = new FileInfoService();
    this.aiProcessorService = new AIProcessorService(
      aiClassificationService,
      this.fileMoveService,
      fileInfoService,
      this.fileStatusService
    );
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
   * 获取指定任务的文件列表
   */
  async getTaskFiles(taskId: string): Promise<ProcessedFile[]> {
    return this.fileStatusService.getTaskFiles(taskId);
  }

  /**
   * 更新已知目录列表，添加新创建的目录
   */
  private updateKnownDirectories(newDirPath: string): void {
    const relativeDir = path.relative(ROOT_DIR, newDirPath);
    if (relativeDir && !this.currentKnownDirs.includes(relativeDir)) {
      this.currentKnownDirs.push(relativeDir);
      mainLogger.debug({ dir: relativeDir }, '添加新目录');
    }
  }

  /**
   * 设置任务运行上下文
   */
  private setupTaskContext(taskId: string, startTime: number, dryRun: boolean): void {
    MainService.isRunning = true;
    MainService.currentTaskId = taskId;
    MainService.currentTaskStartTime = startTime;
    MainService.currentTaskDryRun = dryRun;
    setCurrentTaskId(taskId);
    mainLogger.info({ taskId, dryRun }, '任务开始');
  }

  /**
   * 清理任务运行上下文
   */
  private cleanupTaskContext(): void {
    setCurrentTaskId(null);
    MainService.isRunning = false;
    MainService.currentTaskId = null;
    MainService.currentTaskStartTime = null;
    MainService.currentTaskDryRun = false;
  }

  /**
   * 构建空任务结果（无文件需要处理）
   */
  private buildEmptyTaskResult(taskId: string, startTime: number) {
    mainLogger.info({ taskId }, '没有需要处理的文件');
    this.cleanupTaskContext();

    return {
      taskId,
      similarityMatched: 0,
      aiClassified: 0,
      totalProcessed: 0,
      duration: Date.now() - startTime,
      tokensUsed: 0,
      fileTypes: {},
      status: 'success' as const,
    };
  }

  /**
   * 处理任务执行错误
   */
  private async handleTaskError(
    taskId: string,
    startTime: number,
    error: unknown,
    processedFiles?: ProcessedFile[]
  ) {
    mainLogger.error({ err: error, taskId }, '任务执行失败');

    // 即使任务失败，也要保存已处理的文件信息
    if (processedFiles && processedFiles.length > 0) {
      await this.fileStatusService.saveFileList(taskId, processedFiles);
    }

    flushLogs();
    this.cleanupTaskContext();

    return {
      taskId,
      similarityMatched: 0,
      aiClassified: 0,
      totalProcessed: 0,
      duration: Date.now() - startTime,
      tokensUsed: 0,
      fileTypes: {},
      status: 'failed' as const,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  /**
   * 扫描文件并初始化任务数据
   */
  private async scanAndInitializeTask(taskId: string): Promise<{
    processedFiles: ProcessedFile[];
    fileTypes: Record<string, number>;
    knownFiles: string[];
  }> {
    // 初始化已知目录列表
    this.currentKnownDirs = this.fileScanService.scanDirs(ROOT_DIR);

    const knownFiles = this.fileScanService.scanFiles(ROOT_DIR);
    const filesToProcess = this.fileScanService.getIncomingFiles(INCOMING_DIR);

    mainLogger.info({ files: filesToProcess.length }, '开始扫描文件并创建记录');

    // 创建文件记录
    const processedFiles = await this.initializeFileRecords(taskId, filesToProcess);

    // 统计文件类型
    const fileTypes: Record<string, number> = {};
    for (const file of processedFiles) {
      fileTypes[file.type] = (fileTypes[file.type] || 0) + 1;
    }

    return { processedFiles, fileTypes, knownFiles };
  }

  /**
   * 在扫描阶段批量创建文件记录
   */
  private async initializeFileRecords(
    taskId: string,
    filesToProcess: string[]
  ): Promise<ProcessedFile[]> {
    const processedFiles: ProcessedFile[] = [];

    for (const fileName of filesToProcess) {
      const filePath = path.join(INCOMING_DIR, fileName);
      const ext = FileUtils.getFileExtension(fileName);

      // 获取文件大小
      const sizeStr = FileUtils.getFileSize(filePath);

      // 创建初始文件记录
      const processedFile: ProcessedFile = {
        name: fileName,
        originalPath: filePath,
        type: ext,
        size: sizeStr,
        status: 'pending',
        timestamp: Date.now(),
        processStage: 'scan',
        progress: 0,
      };

      processedFiles.push(processedFile);
    }

    mainLogger.info({ taskId, fileCount: processedFiles.length }, '文件记录初始化完成');

    // 立即保存初始化的文件列表
    await this.fileStatusService.saveFileList(taskId, processedFiles);

    return processedFiles;
  }

  /**
   * 处理相似度匹配 - 匹配阶段
   */
  private async performSimilarityMatching(
    taskId: string,
    processedFiles: ProcessedFile[],
    knownFiles: string[]
  ): Promise<{
    similarityResults: Array<{
      fileName: string;
      filePath: string;
      bestDir: string | null;
      bestScore: number;
      similarFile: string | null;
    }>;
    needAIClassification: ProcessedFile[];
  }> {
    mainLogger.info({ files: processedFiles.length }, '开始相似度匹配');

    const similarityResults: Array<{
      fileName: string;
      filePath: string;
      bestDir: string | null;
      bestScore: number;
      similarFile: string | null;
    }> = [];
    const needAIClassification: ProcessedFile[] = [];

    // 批量更新：准备批量更新数据
    const similarityUpdates: Array<{ fileName: string; updates: Partial<ProcessedFile> }> = [];

    for (const file of processedFiles) {
      // 更新状态为"相似度匹配中"
      similarityUpdates.push({
        fileName: file.name,
        updates: {
          status: 'similarity_matching',
          processStage: 'similarity',
          progress: 25,
        },
      });

      const { bestDir, bestRelPath, bestScore } = SimilarityUtils.findMostSimilarFile(
        file.name,
        knownFiles
      );

      if (bestDir && bestScore >= SIMILARITY_THRESHOLD) {
        // 相似度匹配成功
        similarityResults.push({
          fileName: file.name,
          filePath: file.originalPath,
          bestDir,
          bestScore,
          similarFile: bestRelPath,
        });

        mainLogger.debug(
          {
            file: file.name,
            similar: bestRelPath ? path.basename(bestRelPath) : null,
            score: bestScore.toFixed(2),
          },
          '找到相似文件'
        );

        // 更新为匹配成功状态
        similarityUpdates.push({
          fileName: file.name,
          updates: {
            status: 'similarity_matched',
            method: 'similarity',
            score: bestScore,
            targetPath: path.join(ROOT_DIR, bestDir, file.name),
            progress: 50,
          },
        });
      } else {
        // 需要AI分类
        needAIClassification.push(file);

        // 更新状态，标记为需要AI分类
        similarityUpdates.push({
          fileName: file.name,
          updates: {
            status: 'pending',
            method: 'ai',
            score: bestScore,
            progress: 25,
          },
        });
      }
    }

    // 批量保存相似度匹配结果
    await this.fileStatusService.batchUpdateAndSaveFileStatus(
      taskId,
      processedFiles,
      similarityUpdates
    );

    return { similarityResults, needAIClassification };
  }

  /**
   * 移动相似度匹配的文件 - 使用统一的文件移动处理器
   */
  private async moveSimilarityMatchedFiles(
    taskId: string,
    processedFiles: ProcessedFile[],
    similarityResults: Array<{
      fileName: string;
      filePath: string;
      bestDir: string;
      bestScore: number;
    }>,
    dryRun: boolean
  ): Promise<number> {
    mainLogger.info({ files: similarityResults.length }, '开始移动相似度匹配的文件');

    // 使用文件移动处理器创建移动信息
    const moveInfos = FileMoveProcessorService.createMoveInfosFromSimilarity(similarityResults);

    // 批量移动文件
    const result = await this.fileMoveProcessor.batchMoveFiles(
      taskId,
      processedFiles,
      moveInfos,
      dryRun,
      (directoryPath) => this.updateKnownDirectories(directoryPath)
    );

    return result.successfulMoves;
  }

  /**
   * 执行一次完整的分类任务 - 重构版本
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

    const taskId = TaskUtils.generateTaskId();
    const startTime = Date.now();

    try {
      // 设置任务运行上下文
      this.setupTaskContext(taskId, startTime, dryRun);

      // 第一步：扫描文件并初始化任务数据
      const { processedFiles, fileTypes, knownFiles } = await this.scanAndInitializeTask(taskId);

      // 检查是否有文件需要处理
      if (processedFiles.length === 0) {
        return this.buildEmptyTaskResult(taskId, startTime);
      }

      // 第二步：执行相似度匹配
      const { similarityResults, needAIClassification } = await this.performSimilarityMatching(
        taskId,
        processedFiles,
        knownFiles
      );

      // 第三步：移动相似度匹配的文件
      const successfulMoves = await this.moveSimilarityMatchedFiles(
        taskId,
        processedFiles,
        similarityResults
          .filter((r) => r.bestDir !== null)
          .map((r) => ({
            fileName: r.fileName,
            filePath: r.filePath,
            bestDir: r.bestDir!,
            bestScore: r.bestScore,
          })),
        dryRun
      );

      // 第四步：处理AI分类和移动（使用新的AI处理服务）
      const aiResult: AIProcessResult =
        await this.aiProcessorService.processAIClassificationAndMove(
          taskId,
          processedFiles,
          needAIClassification.map((file) => ({
            fileName: file.name,
            filePath: file.originalPath,
            description: 'Processed file for AI classification', // 可根据需要调整
          })),
          this.currentKnownDirs,
          dryRun
        );

      const totalProcessed = successfulMoves + aiResult.successfulMoves;
      const duration = Date.now() - startTime;

      // 保存最终文件列表
      await this.fileStatusService.saveFileList(taskId, processedFiles);

      // 记录任务完成
      mainLogger.info(
        {
          taskId,
          similarity: successfulMoves,
          ai: aiResult.successfulMoves,
          tokens: aiResult.totalTokensUsed,
          duration,
          filesSaved: processedFiles.length,
        },
        '任务完成'
      );

      // 确保所有日志都写入文件
      flushLogs();

      // 清理任务上下文
      this.cleanupTaskContext();

      return {
        taskId,
        similarityMatched: similarityResults.length,
        aiClassified: needAIClassification.length,
        totalProcessed,
        duration,
        tokensUsed: aiResult.totalTokensUsed,
        fileTypes,
        status: aiResult.taskStatus,
        errorMessage: aiResult.errorMessage,
      };
    } catch (error) {
      // 使用统一的错误处理
      return await this.handleTaskError(taskId, startTime, error);
    }
  }
}
