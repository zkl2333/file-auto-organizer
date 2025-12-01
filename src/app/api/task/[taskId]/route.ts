import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { taskManager } from '@/lib/task-manager';
import { TaskStatus } from '@/lib/task-manager/types';

// GET /api/task/[taskId] - 获取指定任务的详细信息
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Bad Request', message: '任务ID不能为空' },
        { status: 400 }
      );
    }

    const task = taskManager.getTask(taskId);

    if (!task) {
      return NextResponse.json({ error: 'Not Found', message: '任务不存在' }, { status: 404 });
    }

    logger.info({ taskId }, '获取任务详情成功');

    // 转换为前端期望的格式（与任务历史API保持一致）
    const snapshot = task.getSnapshot();
    const response = {
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
      status:
        snapshot.status === TaskStatus.SUCCESS
          ? 'success'
          : snapshot.status === TaskStatus.FAILED
            ? 'failed'
            : snapshot.status === TaskStatus.RUNNING
              ? 'running'
              : 'partial',
      dryRun: snapshot.dryRun,
      errorMessage: snapshot.errorMessage,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      {
        taskId: await params.then((p) => p.taskId),
        error: error instanceof Error ? error.message : String(error),
      },
      '获取任务详情失败'
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

// DELETE /api/task/[taskId] - 删除指定任务
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Bad Request', message: '任务ID不能为空' },
        { status: 400 }
      );
    }

    await taskManager.deleteTask(taskId);

    logger.info({ taskId }, '删除任务成功');

    return NextResponse.json({
      success: true,
      message: '任务删除成功',
    });
  } catch (error) {
    logger.error(
      {
        taskId: await params.then((p) => p.taskId),
        error: error instanceof Error ? error.message : String(error),
      },
      '删除任务失败'
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
