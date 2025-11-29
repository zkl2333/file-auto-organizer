import path from 'node:path';
import { mainLogger, setCurrentTaskId } from '@/lib/logger';
import { getTaskConfig } from '@/lib/config';
import { TaskUtils } from '@/lib/utils/task-utils';
import { v4 as uuidv4 } from 'uuid';

// 任务执行结果类型
export interface TaskResult {
  taskId: string;
  similarityMatched: number;
  aiClassified: number;
  totalProcessed: number;
  duration: number;
  tokensUsed: number;
  fileTypes: Record<string, number>;
  status: 'success' | 'failed' | 'running';
  errorMessage?: string;
}

// 文件处理状态类型
export interface ProcessedFile {
  id: string;
  taskId: string;
  originalPath: string;
  targetPath?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  similarityMatch?: boolean;
  aiClassification?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 主服务类 - Next.js 适配版本
 * 职责：任务流程编排和协调
 */
export class MainService {
  // 静态锁，确保同一时间只有一个任务在运行
  private static isRunning = false;
  private static currentTaskId: string | null = null;
  private static currentTaskStartTime: number | null = null;
  private static currentTaskDryRun: boolean = false;

  private config = getTaskConfig();
  private currentKnownDirs: string[] = []; // 动态维护的已知目录列表

  constructor() {
    // 初始化已知目录列表
    this.currentKnownDirs = this.scanDirectories();
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
    // 这里应该从存储中获取文件列表
    // 暂时返回空数组，后续可以实现文件状态服务
    return [];
  }

  /**
   * 扫描目录获取已知文件夹列表
   */
  private scanDirectories(): string[] {
    try {
      const { rootDir } = this.config;
      const fs = require('fs');
      const path = require('path');

      // 解析为绝对路径，相对于当前工作目录
      const absoluteRootDir = path.resolve(process.cwd(), rootDir);

      if (!fs.existsSync(absoluteRootDir)) {
        mainLogger.warn({ rootDir, absoluteRootDir, cwd: process.cwd() }, '根目录不存在');
        return [];
      }

      const entries = fs.readdirSync(absoluteRootDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !name.startsWith('.'));
    } catch (error) {
      mainLogger.error({ error }, '扫描目录失败');
      return [];
    }
  }

  /**
   * 扫描待处理文件
   */
  private scanIncomingFiles(): string[] {
    try {
      const { incomingDir } = this.config;
      const fs = require('fs');
      const path = require('path');

      // 解析为绝对路径，相对于当前工作目录
      const absoluteIncomingDir = path.resolve(process.cwd(), incomingDir);

      if (!fs.existsSync(absoluteIncomingDir)) {
        mainLogger.warn(
          { incomingDir, absoluteIncomingDir, cwd: process.cwd() },
          '待处理目录不存在'
        );
        return [];
      }

      const entries = fs.readdirSync(absoluteIncomingDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(absoluteIncomingDir, entry.name));
    } catch (error) {
      mainLogger.error({ error }, '扫描待处理文件失败');
      return [];
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
   * 执行文件整理任务（主要入口点）
   */
  async runOnce(dryRun: boolean = false): Promise<TaskResult> {
    const taskId = uuidv4();
    const startTime = Date.now();

    try {
      // 设置任务上下文
      this.setupTaskContext(taskId, startTime, dryRun);

      mainLogger.info({ taskId, dryRun }, '开始执行文件整理任务');

      // 扫描文件
      const filesToProcess = this.scanIncomingFiles();

      if (filesToProcess.length === 0) {
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
          status: 'success',
        };
      }

      mainLogger.info({ taskId, fileCount: filesToProcess.length }, '发现待处理文件');

      // 统计文件类型
      const fileTypes: Record<string, number> = {};
      const processedFiles: ProcessedFile[] = [];

      for (const filePath of filesToProcess) {
        try {
          const fileName = path.basename(filePath);
          const ext = path.extname(fileName).toLowerCase();
          const fileType = ext || 'unknown';

          fileTypes[fileType] = (fileTypes[fileType] || 0) + 1;

          // 创建文件记录
          const processedFile: ProcessedFile = {
            id: uuidv4(),
            taskId,
            originalPath: filePath,
            fileName,
            fileType,
            fileSize: 0, // 可以在后续实现中获取实际文件大小
            status: dryRun ? 'completed' : 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          processedFiles.push(processedFile);

          mainLogger.debug(
            {
              taskId,
              fileName,
              fileType,
              dryRun,
            },
            '处理文件'
          );
        } catch (error) {
          mainLogger.error(
            {
              taskId,
              filePath,
              error: error instanceof Error ? error.message : String(error),
            },
            '处理文件失败'
          );
        }
      }

      // 模拟处理时间
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.cleanupTaskContext();

      const result: TaskResult = {
        taskId,
        similarityMatched: 0,
        aiClassified: 0,
        totalProcessed: processedFiles.length,
        duration: Date.now() - startTime,
        tokensUsed: 0,
        fileTypes,
        status: 'success',
      };

      mainLogger.info(
        {
          taskId,
          totalProcessed: result.totalProcessed,
          duration: result.duration,
          fileTypes,
        },
        '任务执行完成'
      );

      return result;
    } catch (error) {
      mainLogger.error(
        {
          taskId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        '任务执行失败'
      );

      this.cleanupTaskContext();

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
