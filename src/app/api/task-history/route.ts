import { NextRequest, NextResponse } from 'next/server';
import { systemLogger } from '@/lib/logger';
import { MainService } from '@/lib/services/main.service';
import { StatsService } from '@/lib/services/stats.service';

// GET /api/task-history - 获取所有任务历史
export async function GET(request: NextRequest) {
  try {
    const statsService = new StatsService();
    const runningStatus = MainService.getRunningStatus();

    // 获取已保存的任务历史
    let tasks = statsService.getAllTaskRecords();

    // 如果有运行中的任务，添加到列表或更新现有记录
    if (runningStatus.isRunning && runningStatus.taskId && runningStatus.startTime) {
      const runningTask = {
        taskId: runningStatus.taskId,
        timestamp: new Date(runningStatus.startTime).toISOString(),
        startTime: new Date(runningStatus.startTime).toISOString(),
        endTime: '',
        duration: Date.now() - runningStatus.startTime,
        aiCalls: 0,
        tokensUsed: 0,
        filesProcessed: 0,
        similarityMatched: 0,
        aiClassified: 0,
        fileTypes: {},
        status: 'running' as const,
        dryRun: runningStatus.dryRun,
      };

      // 检查是否已存在该任务的记录，如果存在则更新为运行状态
      const existingIndex = tasks.findIndex((task) => task.taskId === runningStatus.taskId);
      if (existingIndex >= 0) {
        tasks[existingIndex] = { ...tasks[existingIndex], ...runningTask };
      } else {
        tasks.push(runningTask);
      }
    }

    // 按时间倒序排列
    tasks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ tasks });
  } catch (error) {
    systemLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      '获取任务历史失败'
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
