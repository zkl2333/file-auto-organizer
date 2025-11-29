import path from 'node:path';
import { mainLogger, setCurrentTaskId } from '@/lib/logger';
import { getTaskConfig } from '@/lib/config';
import { TaskUtils } from '@/lib/utils/task-utils';
import { v4 as uuidv4 } from 'uuid';
import {
  type ProcessedFile,
  type FileProcessStatus,
  type FileProcessStage,
  type FileProcessMethod,
} from '@/lib/api-client';
import { StatsService } from './stats.service';
import { FileStatusService } from './file-status.service';

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
  private statsService = new StatsService(); // 统计服务实例
  private fileStatusService = new FileStatusService(); // 文件状态服务实例

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
    try {
      return await this.fileStatusService.getTaskFiles(taskId);
    } catch (error) {
      mainLogger.error({ taskId, error }, '获取任务文件列表失败');
      return [];
    }
  }

  /**
   * 获取指定任务的详细信息
   */
  async getTaskDetail(taskId: string) {
    try {
      return await this.statsService.getTaskDetail(taskId);
    } catch (error) {
      mainLogger.error({ taskId, error }, '获取任务详情失败');
      return null;
    }
  }

  /**
   * 获取指定任务的日志
   */
  async getTaskLogs(taskId: string, type: string = 'main', limit: number = 200): Promise<string[]> {
    try {
      const fs = require('fs');
      const path = require('path');

      // 构建日志文件路径
      const logFileName = `task-${taskId}-${type}.log`;
      const logFilePath = path.join(process.cwd(), 'logs', 'tasks', logFileName);

      if (!fs.existsSync(logFilePath)) {
        return [];
      }

      // 读取日志文件内容
      const logContent = fs.readFileSync(logFilePath, 'utf-8');
      const logLines = logContent.split('\n').filter((line: string) => line.trim());

      // 返回指定数量的最新日志（倒序）
      return logLines.slice(-limit).reverse();
    } catch (error) {
      mainLogger.error({ taskId, type, error }, '获取任务日志失败');
      return [];
    }
  }

  /**
   * 删除指定任务
   */
  async deleteTask(taskId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 删除统计记录
      await this.statsService.deleteTask(taskId);

      // 删除文件状态记录
      await this.fileStatusService.deleteTask(taskId);

      mainLogger.info({ taskId }, '删除任务成功');

      return {
        success: true,
        message: '任务删除成功',
      };
    } catch (error) {
      mainLogger.error({ taskId, error }, '删除任务失败');

      return {
        success: false,
        message: error instanceof Error ? error.message : '删除任务失败',
      };
    }
  }

  /**
   * 根据文件名和类型确定处理方式
   */
  private determineProcessMethod(
    fileName: string,
    fileType: string
  ): 'similarity' | 'ai' | 'manual' {
    // 模拟处理逻辑：某些文件类型优先使用相似度匹配
    const similarityPriorityTypes = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx'];

    if (similarityPriorityTypes.includes(fileType.toLowerCase())) {
      // 70% 概率使用相似度匹配
      return Math.random() < 0.7 ? 'similarity' : 'ai';
    } else {
      // 其他文件类型优先使用AI分类
      return Math.random() < 0.6 ? 'ai' : 'similarity';
    }
  }

  /**
   * 生成目标路径
   */
  private generateTargetPath(
    fileName: string,
    fileType: string,
    method: 'similarity' | 'ai' | 'manual'
  ): string {
    const { rootDir } = this.config;

    // 根据文件类型和处理方式生成目标目录
    let targetDir = '';

    if (method === 'similarity') {
      // 相似度匹配通常根据文件扩展名分类
      const typeDir = this.getDirectoryByFileType(fileType);
      targetDir = path.join(rootDir, typeDir);
    } else if (method === 'ai') {
      // AI分类根据文件内容智能分类
      const aiDir = this.getAIClassifiedDirectory(fileName, fileType);
      targetDir = path.join(rootDir, aiDir);
    } else {
      // 手动分类使用默认目录
      targetDir = path.join(rootDir, 'manual-sort');
    }

    return path.join(targetDir, fileName);
  }

  /**
   * 根据文件类型获取目录
   */
  private getDirectoryByFileType(fileType: string): string {
    const typeMap: Record<string, string> = {
      '.jpg': 'images',
      '.jpeg': 'images',
      '.png': 'images',
      '.gif': 'images',
      '.pdf': 'documents',
      '.doc': 'documents',
      '.docx': 'documents',
      '.txt': 'documents',
      '.xlsx': 'spreadsheets',
      '.xls': 'spreadsheets',
      '.pptx': 'presentations',
      '.ppt': 'presentations',
      '.mp4': 'videos',
      '.avi': 'videos',
      '.mp3': 'audio',
      '.wav': 'audio',
      '.zip': 'archives',
      '.rar': 'archives',
      '.js': 'code',
      '.ts': 'code',
      '.html': 'code',
      '.css': 'code',
      '.md': 'documents',
    };

    return typeMap[fileType.toLowerCase()] || 'others';
  }

  /**
   * 模拟AI分类目录
   */
  private getAIClassifiedDirectory(fileName: string, fileType: string): string {
    const fileNameLower = fileName.toLowerCase();

    // 根据文件名模式进行智能分类
    if (fileNameLower.includes('contract') || fileNameLower.includes('合同')) {
      return 'contracts';
    } else if (fileNameLower.includes('invoice') || fileNameLower.includes('发票')) {
      return 'invoices';
    } else if (fileNameLower.includes('report') || fileNameLower.includes('报告')) {
      return 'reports';
    } else if (fileNameLower.includes('meeting') || fileNameLower.includes('会议')) {
      return 'meetings';
    } else if (fileNameLower.includes('project') || fileNameLower.includes('项目')) {
      return 'projects';
    } else if (fileNameLower.includes('personal') || fileNameLower.includes('个人')) {
      return 'personal';
    } else if (fileNameLower.includes('work') || fileNameLower.includes('工作')) {
      return 'work';
    } else {
      // 使用文件类型作为后备
      return this.getDirectoryByFileType(fileType);
    }
  }

  /**
   * 生成置信度分数
   */
  private generateConfidenceScore(method: 'similarity' | 'ai' | 'manual'): number {
    if (method === 'similarity') {
      // 相似度匹配的置信度通常较高
      return 0.7 + Math.random() * 0.25; // 0.7-0.95
    } else if (method === 'ai') {
      // AI分类的置信度中等
      return 0.6 + Math.random() * 0.3; // 0.6-0.9
    } else {
      // 手动分类没有置信度分数
      return 0;
    }
  }

  /**
   * 生成AI分类原因
   */
  private generateReasoning(
    method: 'similarity' | 'ai' | 'manual',
    fileName: string,
    fileType: string
  ): string | undefined {
    if (method !== 'ai') {
      return undefined;
    }

    const fileNameLower = fileName.toLowerCase();

    // 根据文件名生成分类原因
    if (fileNameLower.includes('contract') || fileNameLower.includes('合同')) {
      return `文件名包含"${fileNameLower.includes('contract') ? 'contract' : '合同'}，识别为合同类文档`;
    } else if (fileNameLower.includes('invoice') || fileNameLower.includes('发票')) {
      return `文件名包含"${fileNameLower.includes('invoice') ? 'invoice' : '发票'}"，识别为发票类文档`;
    } else if (fileNameLower.includes('report') || fileNameLower.includes('报告')) {
      return `文件名包含"${fileNameLower.includes('report') ? 'report' : '报告'}"，识别为报告类文档`;
    } else if (fileType === '.pdf') {
      return `基于PDF文件内容和结构分析，归类为文档类`;
    } else if (['.jpg', '.jpeg', '.png'].includes(fileType)) {
      return `图像文件分析，识别为图片类文件`;
    } else {
      return `基于文件名模式"${fileName}"和类型${fileType}的智能分类结果`;
    }
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
        .filter((entry: any) => entry.isDirectory())
        .map((entry: any) => entry.name)
        .filter((name: string) => !name.startsWith('.'));
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
        .filter((entry: any) => entry.isFile())
        .map((entry: any) => path.join(absoluteIncomingDir, entry.name));
    } catch (error) {
      mainLogger.error({ error }, '扫描待处理文件失败');
      return [];
    }
  }

  /**
   * 获取文件大小（字节）
   */
  private getFileSize(filePath: string): number {
    try {
      const fs = require('fs');
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      mainLogger.warn({ filePath, error }, '获取文件大小失败');
      return 0;
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
   * 保存任务记录到统计服务
   */
  private saveTaskRecord(
    taskId: string,
    startTime: number,
    result: Omit<TaskResult, 'taskId'>
  ): void {
    try {
      this.statsService.recordTaskStats({
        taskId,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: result.duration,
        aiCalls: 0, // TODO: 实际的 AI 调用次数
        tokensUsed: result.tokensUsed,
        filesProcessed: result.totalProcessed,
        similarityMatched: result.similarityMatched,
        aiClassified: result.aiClassified,
        fileTypes: result.fileTypes,
        status: result.status as 'success' | 'partial' | 'failed' | 'running',
        errorMessage: result.errorMessage,
        dryRun: MainService.currentTaskDryRun,
      });

      mainLogger.info({ taskId }, '任务记录已保存到统计服务');
    } catch (error) {
      mainLogger.error({ taskId, error }, '保存任务记录失败');
    }
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
    const taskId = TaskUtils.generateTaskId();
    const startTime = Date.now();

    try {
      // 设置任务上下文
      this.setupTaskContext(taskId, startTime, dryRun);

      mainLogger.info({ taskId, dryRun }, '开始执行文件整理任务');

      // 扫描文件
      const filesToProcess = this.scanIncomingFiles();

      if (filesToProcess.length === 0) {
        mainLogger.info({ taskId }, '没有需要处理的文件');

        const result = {
          similarityMatched: 0,
          aiClassified: 0,
          totalProcessed: 0,
          duration: Date.now() - startTime,
          tokensUsed: 0,
          fileTypes: {},
          status: 'success' as const,
        };

        // 保存任务记录
        this.saveTaskRecord(taskId, startTime, result);
        this.cleanupTaskContext();

        return {
          taskId,
          ...result,
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

          // 获取文件大小
          const fileSize = TaskUtils.formatFileSize(this.getFileSize(filePath));

          // 模拟处理方式和目标路径生成
          const processMethod = this.determineProcessMethod(fileName, fileType);
          const targetPath = this.generateTargetPath(fileName, fileType, processMethod);
          const score = this.generateConfidenceScore(processMethod);
          const reasoning = this.generateReasoning(processMethod, fileName, fileType);

          // 创建文件记录 - 兼容旧版格式
          const processedFile: ProcessedFile = {
            name: fileName,
            originalPath: filePath,
            targetPath,
            type: fileType,
            size: fileSize,
            status: dryRun ? 'success' : 'pending',
            method: processMethod,
            score,
            reasoning,
            timestamp: Date.now(),
            processStage: dryRun ? 'complete' : 'scan',
            progress: dryRun ? 100 : 0,
            taskId,
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

      // 保存初始文件列表到任务目录
      try {
        await this.fileStatusService.saveFileList(taskId, processedFiles);
        mainLogger.info({ taskId, fileCount: processedFiles.length }, '初始文件列表已保存');
      } catch (error) {
        mainLogger.error({ taskId, error }, '保存初始文件列表失败');
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

      // 保存任务记录
      this.saveTaskRecord(taskId, startTime, result);

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

      const result = {
        similarityMatched: 0,
        aiClassified: 0,
        totalProcessed: 0,
        duration: Date.now() - startTime,
        tokensUsed: 0,
        fileTypes: {},
        status: 'failed' as const,
        errorMessage: error instanceof Error ? error.message : String(error),
      };

      // 保存任务记录
      this.saveTaskRecord(taskId, startTime, result);
      this.cleanupTaskContext();

      return {
        taskId,
        ...result,
      };
    }
  }
}
