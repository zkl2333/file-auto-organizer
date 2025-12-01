import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { taskManager } from '@/lib/task-manager';
import { FileStatusService } from '@/lib/services/file-status.service';

const fileStatusService = new FileStatusService();

// GET /api/task/[taskId]/files - 获取指定任务的文件处理结果
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

    // 优先使用内存中的文件列表，否则从磁盘加载
    let files = task.files;
    if (files.length === 0) {
      files = await fileStatusService.getTaskFiles(taskId);
    }

    logger.info({ taskId, fileCount: files.length }, '获取任务文件列表成功');

    return NextResponse.json({
      taskId,
      files,
      totalFiles: files.length,
    });
  } catch (error) {
    logger.error(
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
