import { NextRequest, NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { DashboardStats } from '@/types';
import { verifyAuth } from '@/lib/auth';

/**
 * 获取统计信息 API
 * GET /api/stats
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const config = await loadConfig();

    // 初始化统计信息
    const stats: DashboardStats = {
      totalFiles: 0,
      processedFiles: 0,
      errorFiles: 0,
      pendingFiles: 0,
      categories: {},
      recentActivity: [],
    };

    // 模拟目录统计（生产环境中应实现实际扫描）
    stats.categories = {
      Documents: 45,
      Images: 120,
      Videos: 23,
      Others: 67,
    };
    stats.totalFiles = 255;
    stats.processedFiles = 200;
    stats.errorFiles = 5;
    stats.pendingFiles = 50;

    // 模拟最近活动
    stats.recentActivity = [
      {
        id: '1',
        type: 'file_processed',
        description: 'Successfully processed 15 files',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30分钟前
        details: { processedCount: 15, errorsCount: 0 },
      },
      {
        id: '2',
        type: 'task_completed',
        description: 'Scheduled task completed',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2小时前
        details: { duration: 120, filesProcessed: 42 },
      },
      {
        id: '3',
        type: 'error_occurred',
        description: 'Error occurred during file processing',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5小时前
        details: { errorCode: 'FILE_ACCESS_DENIED', fileName: 'protected.pdf' },
      },
    ];

    // 返回统计信息，兼容原始格式
    const legacyStats = {
      directories: {
        rootDir: config.directories.root_dir,
        incomingDir: config.directories.incoming_dir,
        rootDirExists: stats.totalFiles > 0,
        incomingDirExists: stats.pendingFiles >= 0,
      },
      files: {
        totalInRoot: stats.totalFiles,
        totalInIncoming: stats.pendingFiles,
        categories: Object.keys(stats.categories).length,
      },
      config: {
        cronSchedule: config.cron.schedule,
        logLevel: config.logging.level,
        similarityThreshold: config.scan.similarity_threshold,
        aiBatchSize: config.ai.batch_size,
      },
      ...stats, // 包含新的统计信息格式
    };

    return NextResponse.json({
      success: true,
      data: legacyStats,
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats',
      },
      { status: 500 }
    );
  }
}
