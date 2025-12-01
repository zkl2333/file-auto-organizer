import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '@/lib/config';
import { StatsService } from '@/lib/services/stats.service';
import { FileScanService } from '@/lib/services/file-scan.service';
import { DashboardStats, ActivityItem } from '@/types';

/**
 * 获取统计信息 API
 * GET /api/stats
 */
export async function GET() {
  try {
    const config = await loadConfig();
    const statsService = new StatsService();
    const fileScanService = new FileScanService();

    const rootDir = config.directories.root_dir;
    const incomingDir = config.directories.incoming_dir;

    // 检查目录是否存在
    const rootDirExists = fs.existsSync(rootDir);
    const incomingDirExists = fs.existsSync(incomingDir);

    // 扫描文件
    const rootFiles = rootDirExists ? fileScanService.scanFiles(rootDir) : [];
    const incomingFiles = incomingDirExists ? fileScanService.getIncomingFiles(incomingDir) : [];

    // 扫描分类目录
    const categoryDirs = rootDirExists ? fileScanService.scanDirs(rootDir) : [];
    const topLevelCategories = categoryDirs
      .filter((d) => !d.includes(path.sep) || d.split(path.sep).length === 2)
      .map((d) => d.replace(/[\\/]$/, ''));

    // 统计每个分类的文件数
    const categories: Record<string, number> = {};
    for (const file of rootFiles) {
      const parts = file.split(path.sep);
      const category = parts.length > 1 ? parts[0] : 'Root';
      categories[category] = (categories[category] || 0) + 1;
    }

    // 获取任务统计
    const aggregatedStats = statsService.getStats('all', true);
    const taskRecords = statsService.getAllTaskRecords();

    // 计算错误文件数
    const errorFiles = taskRecords.reduce((sum, r) => {
      if (r.status === 'failed' || r.status === 'partial') {
        return sum + (r.filesProcessed > 0 ? 1 : 0);
      }
      return sum;
    }, 0);

    // 生成最近活动（从任务记录）
    const recentActivity: ActivityItem[] = taskRecords
      .slice(-10)
      .reverse()
      .map((record) => ({
        id: record.taskId,
        type:
          record.status === 'failed'
            ? 'error_occurred'
            : record.status === 'success'
              ? 'task_completed'
              : 'file_processed',
        description:
          record.status === 'failed'
            ? `Task failed: ${record.errorMessage || 'Unknown error'}`
            : `Processed ${record.filesProcessed} files (${record.similarityMatched} matched, ${record.aiClassified} AI)`,
        timestamp: new Date(record.startTime),
        details: {
          filesProcessed: record.filesProcessed,
          aiCalls: record.aiCalls,
          tokensUsed: record.tokensUsed,
          dryRun: record.dryRun,
        },
      }));

    const stats: DashboardStats = {
      totalFiles: rootFiles.length,
      processedFiles: aggregatedStats.totalFilesProcessed,
      errorFiles,
      pendingFiles: incomingFiles.length,
      categories,
      recentActivity,
    };

    const response = {
      directories: {
        rootDir,
        incomingDir,
        rootDirExists,
        incomingDirExists,
      },
      files: {
        totalInRoot: rootFiles.length,
        totalInIncoming: incomingFiles.length,
        categories: topLevelCategories.length,
      },
      config: {
        cronSchedule: config.cron.schedule,
        similarityThreshold: config.scan.similarity_threshold,
        aiBatchSize: config.ai.batch_size,
      },
      aggregated: {
        totalAiCalls: aggregatedStats.totalAiCalls,
        totalTokensUsed: aggregatedStats.totalTokensUsed,
        fileTypes: aggregatedStats.fileTypes,
      },
      ...stats,
    };

    return NextResponse.json({
      success: true,
      data: response,
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
