import { NextResponse } from 'next/server';
import { systemLogger } from '@/lib/logger';
import { taskManager } from '@/lib/task-manager';

// GET /api/task-history - 获取所有任务历史
export async function GET() {
  try {
    // 直接从 TaskManager 获取所有任务
    const allTasks = taskManager.getAllTasks();

    // 转换为API响应格式
    const tasks = allTasks.map((task) => {
      const snapshot = task.getSnapshot();
      return {
        taskId: snapshot.taskId,
        timestamp: new Date(snapshot.startTime).toISOString(),
        startTime: new Date(snapshot.startTime).toISOString(),
        endTime: snapshot.endTime ? new Date(snapshot.endTime).toISOString() : '',
        duration: snapshot.duration,
        aiCalls: snapshot.stats.aiCalls,
        tokensUsed: snapshot.stats.tokensUsed,
        filesProcessed: snapshot.stats.totalProcessed,
        similarityMatched: snapshot.stats.similarityMatched,
        aiClassified: snapshot.stats.aiClassified,
        fileTypes: snapshot.stats.fileTypes,
        status: snapshot.status,
        dryRun: snapshot.dryRun,
        errorMessage: snapshot.errorMessage,
      };
    });

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
