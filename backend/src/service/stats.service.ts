import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { systemLogger } from "../logger.js";

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
  status: 'success' | 'partial' | 'failed'; // 任务状态
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
    this.statsFilePath = path.join(config.LOG_DIR, "stats.json");
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
      fs.writeFileSync(this.statsFilePath, JSON.stringify({ records: [] }, null, 2), "utf-8");
    }
  }

  /**
   * 读取所有统计记录
   */
  private readRecords(): TaskStatsRecord[] {
    try {
      const content = fs.readFileSync(this.statsFilePath, "utf-8");
      const data = JSON.parse(content);
      return data.records || [];
    } catch (error) {
      systemLogger.error({ error }, "读取统计文件失败");
      return [];
    }
  }

  /**
   * 写入统计记录
   */
  private writeRecords(records: TaskStatsRecord[]): void {
    try {
      fs.writeFileSync(
        this.statsFilePath,
        JSON.stringify({ records }, null, 2),
        "utf-8"
      );
    } catch (error) {
      systemLogger.error({ error }, "写入统计文件失败");
    }
  }

  /**
   * 记录一次任务统计
   */
  recordTaskStats(stats: Omit<TaskStatsRecord, "timestamp">): void {
    const records = this.readRecords();
    const newRecord: TaskStatsRecord = {
      timestamp: new Date().toISOString(),
      ...stats,
    };
    records.push(newRecord);
    this.writeRecords(records);
    systemLogger.info({ stats: newRecord }, "任务统计已记录");
  }

  /**
   * 获取所有任务记录
   */
  getAllTaskRecords(): TaskStatsRecord[] {
    return this.readRecords();
  }

  /**
   * 根据任务ID获取任务记录
   */
  getTaskRecord(taskId: string): TaskStatsRecord | null {
    const records = this.readRecords();
    return records.find(r => r.taskId === taskId) || null;
  }

  /**
   * 按时间范围获取统计数据
   * @param range 时间范围
   * @param includeDryRun 是否包含 dry-run 任务，默认不包含
   */
  getStats(range: "today" | "week" | "month" | "all", includeDryRun: boolean = false): AggregatedStats {
    const records = this.readRecords();
    const now = new Date();

    // 计算时间范围起始点
    let startTime: Date | null = null;
    if (range === "today") {
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === "week") {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "month") {
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 过滤记录（按时间范围和是否包含 dry-run）
    let filteredRecords = startTime
      ? records.filter((r) => new Date(r.timestamp) >= startTime!)
      : records;

    // 如果不包含 dry-run，过滤掉 dryRun 为 true 的记录
    if (!includeDryRun) {
      filteredRecords = filteredRecords.filter(r => !r.dryRun);
    }

    // 聚合统计
    let totalAiCalls = 0;
    let totalTokensUsed = 0;
    let totalFilesProcessed = 0;
    const fileTypes: Record<string, number> = {};
    const dailyMap: Record<string, { aiCalls: number; tokensUsed: number; filesProcessed: number }> = {};

    for (const record of filteredRecords) {
      totalAiCalls += record.aiCalls;
      totalTokensUsed += record.tokensUsed;
      totalFilesProcessed += record.filesProcessed;

      // 合并文件类型
      for (const [ext, count] of Object.entries(record.fileTypes)) {
        fileTypes[ext] = (fileTypes[ext] || 0) + count;
      }

      // 按日期聚合
      const date = new Date(record.timestamp).toISOString().split("T")[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { aiCalls: 0, tokensUsed: 0, filesProcessed: 0 };
      }
      dailyMap[date].aiCalls += record.aiCalls;
      dailyMap[date].tokensUsed += record.tokensUsed;
      dailyMap[date].filesProcessed += record.filesProcessed;
    }

    // 转换每日趋势为数组并排序
    const dailyTrends = Object.entries(dailyMap)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalAiCalls,
      totalTokensUsed,
      totalFilesProcessed,
      fileTypes,
      dailyTrends,
    };
  }
}

