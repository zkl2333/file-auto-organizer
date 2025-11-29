import { NextRequest, NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';

/**
 * 获取系统信息 API
 * GET /api/system/info
 */
export async function GET(request: NextRequest) {
  try {
    const config = await loadConfig();

    const systemInfo = {
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      config: {
        rootDir: config.directories.root_dir,
        incomingDir: config.directories.incoming_dir,
        similarityThreshold: config.scan.similarity_threshold,
        aiModel: config.openai.model,
        cronEnabled: config.cron.enabled,
        logLevel: config.logging.level,
      },
    };

    return NextResponse.json({
      success: true,
      data: systemInfo,
    });
  } catch (error) {
    console.error('Failed to get system info:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get system info',
      },
      { status: 500 }
    );
  }
}
