import { NextRequest, NextResponse } from 'next/server';
import { systemLogger } from '@/lib/logger';
import { MainService } from '@/lib/services/main.service';

// GET /api/task/[taskId]/logs - 获取指定任务的日志
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') || 'main';
    const limit = parseInt(searchParams.get('limit') || '200');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Bad Request', message: '任务ID不能为空' },
        { status: 400 }
      );
    }

    const mainService = new MainService();
    const logs = await mainService.getTaskLogs(taskId, type, limit);

    systemLogger.info({ taskId, type, logCount: logs.length }, '获取任务日志成功');

    return NextResponse.json({
      logs,
      type,
      limit,
      count: logs.length
    });
  } catch (error) {
    systemLogger.error(
      {
        taskId: await params.then(p => p.taskId),
        error: error instanceof Error ? error.message : String(error),
      },
      '获取任务日志失败'
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