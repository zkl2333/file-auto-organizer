import { NextRequest, NextResponse } from 'next/server';
import { systemLogger } from '@/lib/logger';
import { MainService } from '@/lib/services/main.service';

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

    const mainService = new MainService();
    const taskDetail = await mainService.getTaskDetail(taskId);

    if (!taskDetail) {
      return NextResponse.json({ error: 'Not Found', message: '任务不存在' }, { status: 404 });
    }

    systemLogger.info({ taskId }, '获取任务详情成功');

    return NextResponse.json(taskDetail);
  } catch (error) {
    systemLogger.error(
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

    const mainService = new MainService();
    const result = await mainService.deleteTask(taskId);

    systemLogger.info({ taskId }, '删除任务成功');

    return NextResponse.json(result);
  } catch (error) {
    systemLogger.error(
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
