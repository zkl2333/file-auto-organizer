import { NextResponse } from 'next/server';
import { taskManager } from '@/lib/task-manager';
import { logger } from '@/lib/logger';
import { getConfig } from '@/lib/config';

// GET /api/status - 获取任务运行状态
export async function GET() {
  try {
    // 获取当前配置快照
    const config = getConfig();

    // 获取运行中的任务
    const runningTask = taskManager.getRunningTask();

    // 构造状态响应
    const statusResponse = {
      isRunning: runningTask !== null,
      currentTaskId: runningTask?.taskId ?? null,
      lastRunTime: null, // 后续可以实现历史记录功能
      lastRunStats: null, // 后续可以实现历史记录功能
      cronEnabled: config.cron?.enabled ?? false,
      lastTask: runningTask
        ? {
            taskId: runningTask.taskId,
            startTime: new Date(runningTask.startTime).toISOString(),
            endTime: '',
            duration: runningTask.getDuration(),
            aiCalls: runningTask.stats.aiCalls,
            tokensUsed: runningTask.stats.tokensUsed,
            filesProcessed: runningTask.stats.totalProcessed,
            similarityMatched: runningTask.stats.similarityMatched,
            aiClassified: runningTask.stats.aiClassified,
            fileTypes: runningTask.stats.fileTypes,
            status: 'running',
            dryRun: runningTask.dryRun,
            progress: runningTask.progress,
          }
        : null,
    };

    return NextResponse.json(statusResponse);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      '获取任务状态失败'
    );

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
