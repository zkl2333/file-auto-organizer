import { Task } from './task';
import { TaskResult } from './types';
import { getTaskConfig } from '@/lib/config';
import { setCurrentTaskId, mainLogger } from '@/lib/logger';
import { TaskUtils } from '@/lib/utils/task-utils';
import type { ProcessedFile } from '@/lib/api-client';
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

  constructor(task: Task) {
    this.task = task;
  }

  /**
   * 执行任务
   */
  async execute(): Promise<TaskResult> {
    try {
      // 设置日志上下文
      setCurrentTaskId(this.task.taskId, this.task.dryRun);

      mainLogger.info({ taskId: this.task.taskId, dryRun: this.task.dryRun }, '开始执行任务');

      // 阶段1：扫描文件
      this.task.updateProgress({ currentStage: 'scan' });
      const filesToProcess = await this.scanFiles();

      if (filesToProcess.length === 0) {
        mainLogger.info({ taskId: this.task.taskId }, '没有需要处理的文件');
        this.task.complete({ stats: this.task.stats });
        return this.buildResult();
      }

      this.task.updateProgress({
        totalFiles: filesToProcess.length,
        scannedFiles: filesToProcess.length,
      });

      mainLogger.info(
        { taskId: this.task.taskId, fileCount: filesToProcess.length },
        '发现待处理文件'
      );

      // 阶段2：处理文件
      this.task.updateProgress({ currentStage: 'process' });
      await this.processFiles(filesToProcess);

      // 阶段3：完成任务
      this.task.updateProgress({ currentStage: 'finalize' });
      this.task.complete({ stats: this.task.stats });

      mainLogger.info(
        {
          taskId: this.task.taskId,
          stats: this.task.stats,
        },
        '任务执行完成'
      );

      return this.buildResult();
    } catch (error) {
      mainLogger.error({ taskId: this.task.taskId, error }, '任务执行失败');
      throw error;
    } finally {
      // 清理日志上下文
      setCurrentTaskId(null);
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
        mainLogger.warn({ incomingDir, absoluteIncomingDir }, '待处理目录不存在');
        return [];
      }

      const entries = fs.readdirSync(absoluteIncomingDir, {
        withFileTypes: true,
      });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(absoluteIncomingDir, entry.name));
    } catch (error) {
      mainLogger.error({ error }, '扫描待处理文件失败');
      return [];
    }
  }

  /**
   * 处理文件
   */
  private async processFiles(filePaths: string[]): Promise<void> {
    const fileTypes: Record<string, number> = {};
    let similarityMatchedCount = 0;
    let aiClassifiedCount = 0;
    let totalTokensUsed = 0;
    let aiCallsCount = 0;

    for (const filePath of filePaths) {
      try {
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName).toLowerCase();
        const fileType = ext || 'unknown';

        fileTypes[fileType] = (fileTypes[fileType] || 0) + 1;

        // 获取文件大小
        const fileSize = this.getFileSize(filePath);

        // 模拟处理方式和目标路径生成
        const processMethod = this.determineProcessMethod(fileName, fileType);
        const targetPath = this.generateTargetPath(fileName, fileType, processMethod);
        const score = this.generateConfidenceScore(processMethod);
        const reasoning = this.generateReasoning(processMethod, fileName, fileType);

        // 累计统计数据
        if (processMethod === 'similarity') {
          similarityMatchedCount++;
        } else if (processMethod === 'ai') {
          aiClassifiedCount++;
          aiCallsCount++;
          // 模拟 token 消耗
          totalTokensUsed += Math.floor(100 + Math.random() * 400);
        }

        // 创建文件记录
        const processedFile: ProcessedFile = {
          name: fileName,
          originalPath: filePath,
          targetPath,
          type: fileType,
          size: fileSize,
          status: this.task.dryRun ? 'success' : 'pending',
          method: processMethod,
          score,
          reasoning,
          timestamp: Date.now(),
          processStage: this.task.dryRun ? 'complete' : 'scan',
          progress: this.task.dryRun ? 100 : 0,
          taskId: this.task.taskId,
        };

        this.task.addFile(processedFile);

        // 更新进度
        this.task.updateProgress({
          processedFiles: this.task.files.length,
          similarityMatched: similarityMatchedCount,
          aiClassified: aiClassifiedCount,
        });

        mainLogger.debug({ taskId: this.task.taskId, fileName, fileType }, '处理文件');
      } catch (error) {
        mainLogger.error({ taskId: this.task.taskId, filePath, error }, '处理文件失败');
      }
    }

    // 更新最终统计
    this.task.updateStats({
      similarityMatched: similarityMatchedCount,
      aiClassified: aiClassifiedCount,
      totalProcessed: this.task.files.length,
      tokensUsed: totalTokensUsed,
      aiCalls: aiCallsCount,
      fileTypes,
    });

    // 模拟处理时间
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

  // ========== 以下方法从 MainService 复用 ==========

  private getFileSize(filePath: string): string {
    try {
      const stats = fs.statSync(filePath);
      return TaskUtils.formatFileSize(stats.size);
    } catch (error) {
      mainLogger.warn({ filePath, error }, '获取文件大小失败');
      return '0 B';
    }
  }

  private determineProcessMethod(
    _fileName: string,
    fileType: string
  ): 'similarity' | 'ai' | 'manual' {
    const similarityPriorityTypes = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx'];

    if (similarityPriorityTypes.includes(fileType.toLowerCase())) {
      return Math.random() < 0.7 ? 'similarity' : 'ai';
    } else {
      return Math.random() < 0.6 ? 'ai' : 'similarity';
    }
  }

  private generateTargetPath(
    fileName: string,
    fileType: string,
    method: 'similarity' | 'ai' | 'manual'
  ): string {
    const { rootDir } = this.config;

    let targetDir = '';

    if (method === 'similarity') {
      const typeDir = this.getDirectoryByFileType(fileType);
      targetDir = path.join(rootDir, typeDir);
    } else if (method === 'ai') {
      const aiDir = this.getAIClassifiedDirectory(fileName, fileType);
      targetDir = path.join(rootDir, aiDir);
    } else {
      targetDir = path.join(rootDir, 'manual-sort');
    }

    return path.join(targetDir, fileName);
  }

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

  private getAIClassifiedDirectory(fileName: string, fileType: string): string {
    const fileNameLower = fileName.toLowerCase();

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
      return this.getDirectoryByFileType(fileType);
    }
  }

  private generateConfidenceScore(method: 'similarity' | 'ai' | 'manual'): number {
    if (method === 'similarity') {
      return 0.7 + Math.random() * 0.25;
    } else if (method === 'ai') {
      return 0.6 + Math.random() * 0.3;
    } else {
      return 0;
    }
  }

  private generateReasoning(
    method: 'similarity' | 'ai' | 'manual',
    fileName: string,
    fileType: string
  ): string | undefined {
    if (method !== 'ai') {
      return undefined;
    }

    const fileNameLower = fileName.toLowerCase();

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
}
