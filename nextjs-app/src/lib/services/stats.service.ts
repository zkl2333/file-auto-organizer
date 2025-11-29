import fs from 'node:fs';
import path from 'node:path';
import { systemLogger } from '@/lib/logger';

// 单次任务统计记录
export interface TaskStatsRecord {
  taskId: string; // 任务唯一ID
  timestamp: string; // ISO 时间戳
  startTime: string; // 任务开始时间
  endTime: string; // 任务结束时间
  duration: number; // 执行时长（毫秒）
  aiCalls: number; // AI 调用次数
  tokensUsed: number; // Token 消耗
  filesProcessed: number; // 处理文件数
  similarityMatched: number; // 相似度匹配的文件数
  aiClassified: number; // AI分类的文件数
  fileTypes: Record<string, number>; // 文件类型分布 { ".pdf": 3, ".mp4": 1 }
  status: 'success' | 'partial' | 'failed' | 'running'; // 任务状态
  errorMessage?: string; // 错误信息（如果有）
  dryRun: boolean; // 是否为模拟运行
}

// 聚合统计结果
export interface AggregatedStats {
  totalAiCalls: number;
  totalTokensUsed: number;
  totalFilesProcessed: number;
  fileTypes: Record<string, number>; // 合并的文件类型统计
  dailyTrends: Array<{
    date: string; // YYYY-MM-DD
    aiCalls: number;
    tokensUsed: number;
    filesProcessed: number;
  }>;
}

export class StatsService {
  private statsFilePath: string;

  constructor() {
    // 使用项目根目录下的 logs 目录
    const logsDir = path.join(process.cwd(), 'logs');
    this.statsFilePath = path.join(logsDir, 'stats.json');
    this.ensureStatsFile();
  }

  /**
   * 确保统计文件存在
   */
  private ensureStatsFile(): void {
    const statsDir = path.dirname(this.statsFilePath);
    if (!fs.existsSync(statsDir)) {
      fs.mkdirSync(statsDir, { recursive: true });
    }
    if (!fs.existsSync(this.statsFilePath)) {
      fs.writeFileSync(this.statsFilePath, JSON.stringify({ records: [] }, null, 2), 'utf-8');
    }
  }

  /**
   * 读取所有统计记录
   */
  private readRecords(): TaskStatsRecord[] {
    try {
      const content = fs.readFileSync(this.statsFilePath, 'utf-8');
      const data = JSON.parse(content);
      return data.records || [];
    } catch (error) {
      systemLogger.error({ error }, '读取统计文件失败');
      return [];
    }
  }

  /**
   * 写入统计记录
   */
  private writeRecords(records: TaskStatsRecord[]): void {
    try {
      fs.writeFileSync(this.statsFilePath, JSON.stringify({ records }, null, 2), 'utf-8');
    } catch (error) {
      systemLogger.error({ error }, '写入统计文件失败');
    }
  }

  /**
   * 记录一次任务统计
   */
  recordTaskStats(stats: Omit<TaskStatsRecord, 'timestamp'>): void {
    const records = this.readRecords();
    const newRecord: TaskStatsRecord = {
      timestamp: new Date().toISOString(),
      ...stats,
    };
    records.push(newRecord);
    this.writeRecords(records);
    systemLogger.info({ stats: newRecord }, '任务统计已记录');
  }

  /**
   * 获取所有任务记录
   */
  getAllTaskRecords(): TaskStatsRecord[] {
    return this.readRecords();
  }

  /**
   * 根据时间范围获取聚合统计
   */
  getStats(
    range: 'today' | 'week' | 'month' | 'all' = 'all',
    includeDryRun: boolean = false
  ): AggregatedStats {
    const records = this.readRecords();

    // 过滤记录
    const filteredRecords = records.filter((record) => {
      if (!includeDryRun && record.dryRun) {
        return false;
      }

      const recordDate = new Date(record.startTime);
      const now = new Date();

      switch (range) {
        case 'today':
          return recordDate.toDateString() === now.toDateString();
        case 'week': {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return recordDate >= weekAgo;
        }
        case 'month': {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return recordDate >= monthAgo;
        }
        case 'all':
        default:
          return true;
      }
    });

    // 聚合数据
    const totalAiCalls = filteredRecords.reduce((sum, record) => sum + record.aiCalls, 0);
    const totalTokensUsed = filteredRecords.reduce((sum, record) => sum + record.tokensUsed, 0);
    const totalFilesProcessed = filteredRecords.reduce(
      (sum, record) => sum + record.filesProcessed,
      0
    );

    // 合并文件类型统计
    const fileTypes: Record<string, number> = {};
    filteredRecords.forEach((record) => {
      Object.entries(record.fileTypes).forEach(([type, count]) => {
        fileTypes[type] = (fileTypes[type] || 0) + count;
      });
    });

    // 计算每日趋势
    const dailyTrendsMap = new Map<
      string,
      { aiCalls: number; tokensUsed: number; filesProcessed: number }
    >();

    filteredRecords.forEach((record) => {
      const date = record.startTime.split('T')[0]; // 提取日期部分 YYYY-MM-DD

      if (!dailyTrendsMap.has(date)) {
        dailyTrendsMap.set(date, { aiCalls: 0, tokensUsed: 0, filesProcessed: 0 });
      }

      const trend = dailyTrendsMap.get(date)!;
      trend.aiCalls += record.aiCalls;
      trend.tokensUsed += record.tokensUsed;
      trend.filesProcessed += record.filesProcessed;
    });

    // 转换为数组并按日期排序
    const dailyTrends = Array.from(dailyTrendsMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalAiCalls,
      totalTokensUsed,
      totalFilesProcessed,
      fileTypes,
      dailyTrends,
    };
  }

  /**
   * 获取单个任务记录
   */
  getTaskRecord(taskId: string): TaskStatsRecord | null {
    const records = this.readRecords();
    return records.find((record) => record.taskId === taskId) || null;
  }

  /**
   * 删除任务记录
   */
  deleteTaskRecord(taskId: string): boolean {
    try {
      const records = this.readRecords();
      const filteredRecords = records.filter((record) => record.taskId !== taskId);

      if (filteredRecords.length === records.length) {
        return false; // 没有找到要删除的记录
      }

      this.writeRecords(filteredRecords);
      systemLogger.info({ taskId }, '任务统计记录已删除');
      return true;
    } catch (error) {
      systemLogger.error({ error, taskId }, '删除任务统计记录失败');
      return false;
    }
  }

  /**
   * 清空所有统计记录
   */
  clearAllRecords(): void {
    this.writeRecords([]);
    systemLogger.info('所有统计记录已清空');
  }
}
