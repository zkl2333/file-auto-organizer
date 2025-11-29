import { NextRequest, NextResponse } from 'next/server';
import { systemLogger } from '@/lib/logger';
import { MainService } from '@/lib/services/main.service';

// GET /api/task-files/[taskId] - 获取指定任务的文件处理结果
export async function GET(
  request: NextRequest,
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
    const files = await mainService.getTaskFiles(taskId);

    systemLogger.info({ taskId, fileCount: files.length }, '获取任务文件列表成功');

    return NextResponse.json({
      taskId,
      files,
      count: files.length,
    });
  } catch (error) {
    systemLogger.error(
      {
        taskId: await params.then((p) => p.taskId),
        error: error instanceof Error ? error.message : String(error),
      },
      '获取任务文件列表失败'
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
