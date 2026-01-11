import { NextRequest, NextResponse } from 'next/server';
import { taskManager } from '@/lib/task-manager';
import { logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

// POST /api/trigger - 触发任务执行
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    // 检查是否可以运行任务
    if (!taskManager.canRunTask()) {
      const runningTask = taskManager.getRunningTask();
      return NextResponse.json({
        success: false,
        message: `任务正在执行中（任务ID: ${runningTask?.taskId}），请稍候`,
      });
    }

    // 创建任务
    const task = taskManager.createTask({
      dryRun,
      triggeredBy: 'api',
    });

    // 在后台执行任务，不阻塞响应
    taskManager
      .runTask(task.taskId)
      .then((result) => {
        logger.info(
          {
            taskId: result.taskId,
            result,
            dryRun,
          },
          '任务执行完成'
        );
      })
      .catch((error) => {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            dryRun,
          },
          '任务执行失败'
        );
      });

    return NextResponse.json({
      success: true,
      message: `任务已触发，正在后台执行${dryRun ? ' (dry-run模式)' : ''}`,
      taskId: task.taskId,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      '触发任务失败'
    );

    return NextResponse.json(
      {
        success: false,
        message: '触发任务失败',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
