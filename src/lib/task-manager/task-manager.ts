import { Task } from './task';
import { TaskStatus, TaskCreateOptions, TaskResult } from './types';
import { TaskUtils } from '@/lib/utils/task-utils';
import { StatsService, type TaskStatsRecord } from '@/lib/services/stats.service';
import { FileStatusService } from '@/lib/services/file-status.service';
import { TaskExecutor } from './task-executor';
import { logger } from '@/lib/logger';

/**
 * 任务管理器（单例模式）
 * 职责：
 * 1. 管理所有任务的生命周期
 * 2. 维护任务状态（内存 + 持久化）
 * 3. 控制任务并发（互斥锁）
 * 4. 协调各服务（Stats, FileStatus）
 */
export class TaskManager {
  private static instance: TaskManager | null = null;

  // 内存中的任务缓存（最近100个任务）
  private tasks: Map<string, Task> = new Map();
  private readonly MAX_CACHED_TASKS = 100;

  // 当前运行的任务ID
  private runningTaskId: string | null = null;

  // 服务实例
  private statsService: StatsService;
  private fileStatusService: FileStatusService;

  private constructor() {
    this.statsService = new StatsService();
    this.fileStatusService = new FileStatusService();
    this.loadRecentTasks();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  /**
   * 创建新任务
   */
  createTask(options: TaskCreateOptions = {}): Task {
    const taskId = TaskUtils.generateTaskId();

    const task = new Task(taskId, {
      dryRun: options.dryRun ?? false,
      triggeredBy: options.triggeredBy ?? 'manual',
      metadata: options.metadata,
    });

    // 加入缓存
    this.tasks.set(taskId, task);
    this.pruneCache();

    logger.info({ taskId, options }, '任务已创建');

    return task;
  }

  /**
   * 运行任务
   */
  async runTask(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    // 检查是否可以运行任务（互斥锁）
    if (!this.canRunTask()) {
      throw new Error(`已有任务正在运行 (${this.runningTaskId})，无法启动新任务`);
    }

    try {
      // 设置运行状态
      this.runningTaskId = taskId;
      task.start();

      logger.info({ taskId, dryRun: task.dryRun }, '开始执行任务');

      // 创建执行器并运行
      const executor = new TaskExecutor(task);
      const result = await executor.execute();

      // 保存任务记录到持久化存储
      await this.persistTask(task);

      logger.info({ taskId, result }, '任务执行完成');

      return result;
    } catch (error) {
      // 任务失败处理
      task.fail(error instanceof Error ? error : String(error));
      await this.persistTask(task);

      logger.error({ taskId, error }, '任务执行失败');

      return {
        taskId,
        status: TaskStatus.FAILED,
        duration: task.getDuration(),
        stats: task.stats,
        errorMessage: task.errorMessage,
      };
    } finally {
      // 清理运行状态
      this.runningTaskId = null;
    }
  }

  /**
   * 获取指定任务
   */
  getTask(taskId: string): Task | null {
    // 先从缓存查找
    let task = this.tasks.get(taskId);
    if (task) {
      return task;
    }

    // 从持久化存储加载
    const statsRecord = this.statsService.getTaskRecord(taskId);
    if (statsRecord) {
      task = this.reconstructTaskFromStats(statsRecord);
      this.tasks.set(taskId, task);
      return task;
    }

    return null;
  }

  /**
   * 获取当前运行中的任务
   */
  getRunningTask(): Task | null {
    if (this.runningTaskId) {
      return this.tasks.get(this.runningTaskId) ?? null;
    }
    return null;
  }

  /**
   * 获取所有任务（支持过滤）
   */
  getAllTasks(filter?: { status?: TaskStatus; limit?: number; offset?: number }): Task[] {
    // 从持久化存储加载所有任务
    const allRecords = this.statsService.getAllTaskRecords();

    // 转换为Task对象
    let tasks = allRecords.map((record) => {
      // 优先使用缓存中的任务
      const cachedTask = this.tasks.get(record.taskId);
      if (cachedTask) {
        return cachedTask;
      }
      return this.reconstructTaskFromStats(record);
    });

    // 如果有运行中的任务且不在持久化记录中，添加它
    const runningTask = this.getRunningTask();
    if (runningTask && !tasks.find((t) => t.taskId === runningTask.taskId)) {
      tasks.unshift(runningTask);
    }

    // 应用过滤器
    if (filter?.status) {
      tasks = tasks.filter((task) => task.status === filter.status);
    }

    // 应用分页
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? tasks.length;

    return tasks.slice(offset, offset + limit);
  }

  /**
   * 获取任务统计信息
   */
  getTaskStats(taskId: string): TaskStatsRecord | null {
    return this.statsService.getTaskRecord(taskId);
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    // 不能删除正在运行的任务
    if (this.runningTaskId === taskId) {
      throw new Error('无法删除正在运行的任务');
    }

    // 从缓存移除
    this.tasks.delete(taskId);

    // 从持久化存储删除
    await this.statsService.deleteTask(taskId);
    await this.fileStatusService.deleteTask(taskId);

    logger.info({ taskId }, '任务已删除');
  }

  /**
   * 批量删除任务
   */
  async deleteTasks(taskIds: string[]): Promise<{
    deleted: string[];
    notFound: string[];
  }> {
    const deleted: string[] = [];
    const notFound: string[] = [];

    for (const taskId of taskIds) {
      try {
        await this.deleteTask(taskId);
        deleted.push(taskId);
      } catch {
        notFound.push(taskId);
      }
    }

    return { deleted, notFound };
  }

  /**
   * 检查是否可以运行新任务
   */
  canRunTask(): boolean {
    return this.runningTaskId === null;
  }

  /**
   * 获取运行状态（向后兼容MainService.getRunningStatus）
   */
  getRunningStatus(): {
    isRunning: boolean;
    taskId: string | null;
    startTime: number | null;
    dryRun: boolean;
  } {
    const runningTask = this.getRunningTask();

    return {
      isRunning: runningTask !== null,
      taskId: runningTask?.taskId ?? null,
      startTime: runningTask?.startTime ?? null,
      dryRun: runningTask?.dryRun ?? false,
    };
  }

  /**
   * 持久化任务到存储
   */
  private async persistTask(task: Task): Promise<void> {
    try {
      // 保存统计记录
      this.statsService.recordTaskStats(task.toStatsRecord());

      // 保存文件列表
      if (task.files.length > 0) {
        await this.fileStatusService.saveFileList(task.taskId, task.files);
      }

      logger.debug({ taskId: task.taskId }, '任务已持久化');
    } catch (error) {
      logger.error({ taskId: task.taskId, error }, '持久化任务失败');
    }
  }

  /**
   * 从统计记录重建Task对象
   */
  private reconstructTaskFromStats(record: TaskStatsRecord): Task {
    // 恢复开始时间
    const startTime = new Date(record.startTime).getTime();

    const task = new Task(record.taskId, {
      dryRun: record.dryRun,
      triggeredBy: 'manual', // 无法从记录恢复
      startTime, // 恢复原始开始时间
    });

    // 恢复状态
    if (record.status === 'success') {
      task.status = TaskStatus.SUCCESS;
    } else if (record.status === 'failed') {
      task.status = TaskStatus.FAILED;
    } else if (record.status === 'running') {
      task.status = TaskStatus.RUNNING;
    } else if (record.status === 'partial') {
      // partial 状态映射为 SUCCESS（部分成功也算成功）
      task.status = TaskStatus.SUCCESS;
    }

    // 恢复时间
    if (record.endTime) {
      task.endTime = new Date(record.endTime).getTime();
    }

    // 恢复错误信息
    if (record.errorMessage) {
      task.errorMessage = record.errorMessage;
    }

    // 恢复统计
    task.updateStats({
      similarityMatched: record.similarityMatched,
      aiClassified: record.aiClassified,
      totalProcessed: record.filesProcessed,
      tokensUsed: record.tokensUsed,
      aiCalls: record.aiCalls,
      fileTypes: record.fileTypes,
    });

    // 恢复进度（similarityMatched/aiClassified 通过 stats 代理获取）
    task.updateProgress({
      totalFiles: record.filesProcessed,
      processedFiles: record.filesProcessed,
      currentStage: 'complete',
      percentage: 100,
    });

    return task;
  }

  /**
   * 加载最近的任务到缓存
   */
  private loadRecentTasks(): void {
    const recentRecords = this.statsService.getAllTaskRecords().slice(0, this.MAX_CACHED_TASKS);

    recentRecords.forEach((record) => {
      const task = this.reconstructTaskFromStats(record);
      this.tasks.set(record.taskId, task);
    });

    logger.info({ count: recentRecords.length }, '已加载最近任务到缓存');
  }

  /**
   * 清理缓存（保留最近的任务）
   */
  private pruneCache(): void {
    if (this.tasks.size > this.MAX_CACHED_TASKS) {
      // 按创建时间排序，删除最旧的任务
      const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => b.startTime - a.startTime);

      const toRemove = sortedTasks.slice(this.MAX_CACHED_TASKS);
      toRemove.forEach((task) => {
        this.tasks.delete(task.taskId);
      });

      logger.debug({ removed: toRemove.length }, '清理任务缓存');
    }
  }
}

// 导出单例访问器
export const taskManager = TaskManager.getInstance();
