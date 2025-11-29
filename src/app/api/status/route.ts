import { NextRequest, NextResponse } from 'next/server';
import { MainService } from '@/lib/services/main.service';
import { systemLogger } from '@/lib/logger';
import { getConfig } from '@/lib/config';

// GET /api/status - 获取任务运行状态
export async function GET(request: NextRequest) {
  try {
    // 获取当前配置快照
    const config = getConfig();

    // 获取任务运行状态
    const runningStatus = MainService.getRunningStatus();

    // 构造状态响应
    const statusResponse = {
      isRunning: runningStatus.isRunning,
      currentTaskId: runningStatus.taskId,
      lastRunTime: null, // 后续可以实现历史记录功能
      lastRunStats: null, // 后续可以实现历史记录功能
      cronEnabled: config.cron?.enabled ?? false,
      lastTask: runningStatus.isRunning
        ? {
            taskId: runningStatus.taskId,
            startTime: new Date(runningStatus.startTime!).toISOString(),
            endTime: '',
            duration: Date.now() - runningStatus.startTime!,
            aiCalls: 0,
            tokensUsed: 0,
            filesProcessed: 0,
            similarityMatched: 0,
            aiClassified: 0,
            fileTypes: {},
            status: 'running',
            dryRun: runningStatus.dryRun,
          }
        : null,
    };

    return NextResponse.json(statusResponse);
  } catch (error) {
    systemLogger.error(
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
