import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getConfig, updateConfig } from '@/lib/config';
import { verifyAuth } from '@/lib/auth';

// POST /api/cron/toggle - 切换定时任务状态
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'enabled 字段必须是布尔值',
        },
        { status: 400 }
      );
    }

    // 获取当前配置
    const config = getConfig();

    // 更新配置
    updateConfig({
      cron: {
        ...config.cron,
        enabled: enabled,
      },
    });

    logger.info(
      {
        enabled: enabled,
        schedule: config.cron?.schedule,
      },
      `定时任务状态已${enabled ? '启用' : '禁用'}`
    );

    return NextResponse.json({
      success: true,
      message: `定时任务已成功${enabled ? '启用' : '禁用'}`,
      enabled: enabled,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      '切换定时任务状态失败'
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
