import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { taskManager } from '@/lib/task-manager';

// DELETE /api/tasks - 批量删除任务
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskIds } = body as { taskIds: string[] };

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: '任务ID列表不能为空' },
        { status: 400 }
      );
    }

    logger.info({ count: taskIds.length }, '开始批量删除任务');

    const result = await taskManager.deleteTasks(taskIds);

    logger.info(
      { deleted: result.deleted.length, notFound: result.notFound.length },
      '批量删除任务完成'
    );

    return NextResponse.json({
      success: true,
      message: `成功删除 ${result.deleted.length} 条记录`,
      deleted: result.deleted,
      notFound: result.notFound,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      '批量删除任务失败'
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
        deleted: [],
        notFound: [],
      },
      { status: 500 }
    );
  }
}
