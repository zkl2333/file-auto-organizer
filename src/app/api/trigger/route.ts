import { NextRequest, NextResponse } from 'next/server';
import { MainService } from '@/lib/services/main.service';
import { systemLogger } from '@/lib/logger';

// POST /api/trigger - 触发任务执行
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    // 检查是否有任务正在运行
    const runningStatus = MainService.getRunningStatus();
    if (runningStatus.isRunning) {
      return NextResponse.json({
        success: false,
        message: `任务正在执行中（任务ID: ${runningStatus.taskId}），请稍候`,
      });
    }

    // 创建服务实例并触发任务
    const service = new MainService();

    // 在后台执行任务，不阻塞响应
    service
      .runOnce(dryRun)
      .then((stats) => {
        systemLogger.info(
          {
            taskId: stats.taskId,
            stats,
            dryRun,
          },
          '任务执行完成'
        );

        // 这里可以添加统计记录逻辑，类似原后端的实现
      })
      .catch((error) => {
        systemLogger.error(
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
    });
  } catch (error) {
    systemLogger.error(
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
