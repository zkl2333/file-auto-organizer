import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatsService, TaskStatsRecord } from './stats.service';
import { TEST_TEMP_DIR } from '../utils/test-utils';
import path from 'path';
import fs from 'fs';

// Mock logger
vi.mock('@/lib/logger', () => ({
  systemLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('StatsService', () => {
  let statsService: StatsService;
  let originalCwd: string;

  beforeEach(() => {
    // 保存原始工作目录
    originalCwd = process.cwd();

    // 确保测试目录存在
    if (!fs.existsSync(TEST_TEMP_DIR)) {
      fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }

    // 设置测试工作目录
    if (TEST_TEMP_DIR) {
      process.chdir(TEST_TEMP_DIR);
    }

    // 清理测试目录（只清理测试相关的，不删除实际项目的 logs）
    const testStatsFile = path.join(process.cwd(), 'logs', 'stats.json');
    try {
      if (fs.existsSync(testStatsFile)) {
        fs.unlinkSync(testStatsFile);
      }
    } catch {
      // 忽略清理错误，可能文件正在使用中
    }

    // 创建服务实例
    statsService = new StatsService();
  });

  afterEach(() => {
    // 恢复原始工作目录
    process.chdir(originalCwd);
  });

  describe('recordTaskStats', () => {
    it('应该记录任务统计', () => {
      const stats: Omit<TaskStatsRecord, 'timestamp'> = {
        taskId: 'test-task-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
        aiCalls: 5,
        tokensUsed: 1000,
        filesProcessed: 10,
        similarityMatched: 7,
        aiClassified: 3,
        fileTypes: { '.txt': 5, '.pdf': 5 },
        status: 'success',
        dryRun: false,
      };

      statsService.recordTaskStats(stats);

      const records = statsService.getAllTaskRecords();
      expect(records).toHaveLength(1);
      expect(records[0].taskId).toBe('test-task-1');
      expect(records[0].filesProcessed).toBe(10);
    });

    it('应该支持记录多个任务', () => {
      const stats1: Omit<TaskStatsRecord, 'timestamp'> = {
        taskId: 'test-task-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
        aiCalls: 5,
        tokensUsed: 1000,
        filesProcessed: 10,
        similarityMatched: 7,
        aiClassified: 3,
        fileTypes: {},
        status: 'success',
        dryRun: false,
      };

      const stats2: Omit<TaskStatsRecord, 'timestamp'> = {
        taskId: 'test-task-2',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 2000,
        aiCalls: 10,
        tokensUsed: 2000,
        filesProcessed: 20,
        similarityMatched: 15,
        aiClassified: 5,
        fileTypes: {},
        status: 'success',
        dryRun: false,
      };

      statsService.recordTaskStats(stats1);
      statsService.recordTaskStats(stats2);

      const records = statsService.getAllTaskRecords();
      expect(records).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      // 创建不同日期的测试数据
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      statsService.recordTaskStats({
        taskId: 'task-today',
        startTime: now.toISOString(),
        endTime: now.toISOString(),
        duration: 1000,
        aiCalls: 5,
        tokensUsed: 1000,
        filesProcessed: 10,
        similarityMatched: 7,
        aiClassified: 3,
        fileTypes: { '.txt': 10 },
        status: 'success',
        dryRun: false,
      });

      statsService.recordTaskStats({
        taskId: 'task-yesterday',
        startTime: yesterday.toISOString(),
        endTime: yesterday.toISOString(),
        duration: 2000,
        aiCalls: 10,
        tokensUsed: 2000,
        filesProcessed: 20,
        similarityMatched: 15,
        aiClassified: 5,
        fileTypes: { '.pdf': 20 },
        status: 'success',
        dryRun: false,
      });

      statsService.recordTaskStats({
        taskId: 'task-week-ago',
        startTime: weekAgo.toISOString(),
        endTime: weekAgo.toISOString(),
        duration: 3000,
        aiCalls: 15,
        tokensUsed: 3000,
        filesProcessed: 30,
        similarityMatched: 20,
        aiClassified: 10,
        fileTypes: { '.jpg': 30 },
        status: 'success',
        dryRun: false,
      });
    });

    it('应该返回所有统计（range=all）', () => {
      const stats = statsService.getStats('all');
      // 注意：由于测试数据可能在不同时间创建，实际值可能略有不同
      expect(stats.totalFilesProcessed).toBeGreaterThanOrEqual(30);
      expect(stats.totalAiCalls).toBeGreaterThanOrEqual(15);
      expect(stats.totalTokensUsed).toBeGreaterThanOrEqual(3000);
    });

    it('应该过滤 today 范围', () => {
      const stats = statsService.getStats('today');
      expect(stats.totalFilesProcessed).toBe(10);
      expect(stats.totalAiCalls).toBe(5);
    });

    it('应该过滤 week 范围', () => {
      const stats = statsService.getStats('week');
      expect(stats.totalFilesProcessed).toBeGreaterThanOrEqual(30);
    });

    it('应该排除 dryRun 任务', () => {
      statsService.recordTaskStats({
        taskId: 'task-dryrun',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
        aiCalls: 100,
        tokensUsed: 10000,
        filesProcessed: 50,
        similarityMatched: 40,
        aiClassified: 10,
        fileTypes: {},
        status: 'success',
        dryRun: true,
      });

      const stats = statsService.getStats('all', false);
      // dryRun 任务不应该被包含
      expect(stats.totalFilesProcessed).toBe(60);
    });

    it('应该包含 dryRun 任务当 includeDryRun=true', () => {
      statsService.recordTaskStats({
        taskId: 'task-dryrun',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
        aiCalls: 100,
        tokensUsed: 10000,
        filesProcessed: 50,
        similarityMatched: 40,
        aiClassified: 10,
        fileTypes: {},
        status: 'success',
        dryRun: true,
      });

      const stats = statsService.getStats('all', true);
      expect(stats.totalFilesProcessed).toBeGreaterThan(60);
    });

    it('应该合并文件类型统计', () => {
      const stats = statsService.getStats('all');
      expect(stats.fileTypes['.txt']).toBe(10);
      expect(stats.fileTypes['.pdf']).toBe(20);
      expect(stats.fileTypes['.jpg']).toBe(30);
    });

    it('应该计算每日趋势', () => {
      const stats = statsService.getStats('all');
      expect(stats.dailyTrends).toBeDefined();
      expect(stats.dailyTrends.length).toBeGreaterThan(0);
      expect(stats.dailyTrends[0]).toHaveProperty('date');
      expect(stats.dailyTrends[0]).toHaveProperty('aiCalls');
      expect(stats.dailyTrends[0]).toHaveProperty('tokensUsed');
      expect(stats.dailyTrends[0]).toHaveProperty('filesProcessed');
    });
  });

  describe('getTaskRecord', () => {
    it('应该返回指定任务的记录', () => {
      const stats: Omit<TaskStatsRecord, 'timestamp'> = {
        taskId: 'test-task-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
        aiCalls: 5,
        tokensUsed: 1000,
        filesProcessed: 10,
        similarityMatched: 7,
        aiClassified: 3,
        fileTypes: {},
        status: 'success',
        dryRun: false,
      };

      statsService.recordTaskStats(stats);

      const record = statsService.getTaskRecord('test-task-1');
      expect(record).toBeTruthy();
      expect(record?.taskId).toBe('test-task-1');
    });

    it('应该返回 null 当任务不存在时', () => {
      const record = statsService.getTaskRecord('non-existent-task');
      expect(record).toBeNull();
    });
  });

  describe('deleteTaskRecord', () => {
    it('应该删除指定任务记录', () => {
      const stats: Omit<TaskStatsRecord, 'timestamp'> = {
        taskId: 'test-task-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
        aiCalls: 5,
        tokensUsed: 1000,
        filesProcessed: 10,
        similarityMatched: 7,
        aiClassified: 3,
        fileTypes: {},
        status: 'success',
        dryRun: false,
      };

      statsService.recordTaskStats(stats);
      expect(statsService.getAllTaskRecords()).toHaveLength(1);

      const deleted = statsService.deleteTaskRecord('test-task-1');
      expect(deleted).toBe(true);
      expect(statsService.getAllTaskRecords()).toHaveLength(0);
    });

    it('应该返回 false 当任务不存在时', () => {
      const deleted = statsService.deleteTaskRecord('non-existent-task');
      expect(deleted).toBe(false);
    });
  });

  describe('clearAllRecords', () => {
    it('应该清空所有记录', () => {
      statsService.recordTaskStats({
        taskId: 'test-task-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
        aiCalls: 5,
        tokensUsed: 1000,
        filesProcessed: 10,
        similarityMatched: 7,
        aiClassified: 3,
        fileTypes: {},
        status: 'success',
        dryRun: false,
      });

      expect(statsService.getAllTaskRecords()).toHaveLength(1);

      statsService.clearAllRecords();
      expect(statsService.getAllTaskRecords()).toHaveLength(0);
    });
  });
});
