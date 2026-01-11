import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsService } from '@/lib/services/stats.service';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('StatsService', () => {
  let statsService: StatsService;

  beforeEach(() => {
    vi.clearAllMocks();
    statsService = new StatsService();
  });

  describe('constructor', () => {
    it('应该创建服务实例', () => {
      expect(statsService).toBeInstanceOf(StatsService);
    });

    it('应该初始化统计文件路径', () => {
      expect(statsService).toBeInstanceOf(StatsService);
    });
  });

  describe('recordTaskStats', () => {
    it('应该记录任务统计', () => {
      const stats = {
        taskId: 'test-123',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T01:00:00Z',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: { '.pdf': 5, '.txt': 5 } as const,
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats);

      expect(statsService.getAllTaskRecords()).toHaveLength(1);
    });

    it('应该添加时间戳到记录', () => {
      const stats = {
        taskId: 'test-456',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T01:00:00Z',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats);

      const allRecords = statsService.getAllTaskRecords();
      expect(allRecords[0]).toMatchObject({
        ...stats,
        timestamp: expect.any(String),
      });
    });

    it('应该处理多个记录', () => {
      const stats1 = {
        taskId: 'task-1',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T01:00:00Z',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: { '.pdf': 10 } as const,
        status: 'success' as const,
        dryRun: false,
      };

      const stats2 = {
        taskId: 'task-2',
        startTime: '2024-01-02T00:00:00Z',
        endTime: '2024-01-02T01:00:00Z',
        aiCalls: 3,
        tokensUsed: 60,
        filesProcessed: 6,
        similarityMatched: 2,
        aiClassified: 4,
        fileTypes: { '.txt': 6 } as const,
        status: 'failed' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats1);
      statsService.recordTaskStats(stats2);

      expect(statsService.getAllTaskRecords()).toHaveLength(2);
    });
  });

  describe('getAllTaskRecords', () => {
    it('应该返回所有记录', () => {
      const stats = {
        taskId: 'test-1',
        startTime: '2024-01-01',
        endTime: '2024-01-01',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats);

      const records = statsService.getAllTaskRecords();

      expect(records).toHaveLength(1);
      expect(records[0].taskId).toBe('test-1');
    });

    it('应该返回空数组当没有记录时', () => {
      statsService.clearAllRecords();

      const records = statsService.getAllTaskRecords();

      expect(records).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('应该返回 all 范围统计', () => {
      const stats = {
        taskId: 'test-all',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T01:00:00Z',
        aiCalls: 10,
        tokensUsed: 200,
        filesProcessed: 20,
        similarityMatched: 6,
        aiClassified: 14,
        fileTypes: { '.pdf': 20 } as const,
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats);

      const result = statsService.getStats('all', false);

      expect(result.totalAiCalls).toBe(10);
      expect(result.totalTokensUsed).toBe(200);
      expect(result.totalFilesProcessed).toBe(20);
      expect(Object.keys(result.fileTypes)).toContain('.pdf');
    });

    it('应该按日期聚合每日趋势', () => {
      const stats1 = {
        taskId: 'task-1',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      const stats2 = {
        taskId: 'task-2',
        startTime: '2024-01-02T14:00:00Z',
        endTime: '2024-01-02T15:00:00Z',
        aiCalls: 3,
        tokensUsed: 60,
        filesProcessed: 6,
        similarityMatched: 2,
        aiClassified: 4,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats1);
      statsService.recordTaskStats(stats2);

      const result = statsService.getStats('all', false);

      expect(result.dailyTrends).toHaveLength(2);
      expect(result.dailyTrends[0].date).toBe('2024-01-01');
      expect(result.dailyTrends[0].aiCalls).toBe(5);
      expect(result.dailyTrends[1].date).toBe('2024-01-02');
      expect(result.dailyTrends[1].aiCalls).toBe(3);
    });

    it('应该生成任务趋势数据', () => {
      const stats1 = {
        taskId: 'task-recent',
        startTime: '2024-01-02T10:00:00Z',
        endTime: '2024-01-02T11:00:00Z',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      const stats2 = {
        taskId: 'task-old',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        aiCalls: 3,
        tokensUsed: 60,
        filesProcessed: 6,
        similarityMatched: 2,
        aiClassified: 4,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats1);
      statsService.recordTaskStats(stats2);

      const result = statsService.getStats('all', false);

      expect(result.taskTrends).toHaveLength(2);
      expect(result.taskTrends[0].taskId).toBe('task-old');
      expect(result.taskTrends[1].taskId).toBe('task-recent');
    });

    it('应该过滤 dry run 记录', () => {
      const dryRunStats = {
        taskId: 'dryrun-task',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T01:00:00Z',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: { '.pdf': 10 } as const,
        status: 'success' as const,
        dryRun: true,
      };

      const normalStats = {
        taskId: 'normal-task',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T01:00:00Z',
        aiCalls: 10,
        tokensUsed: 200,
        filesProcessed: 20,
        similarityMatched: 6,
        aiClassified: 14,
        fileTypes: { '.txt': 20 } as const,
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(dryRunStats);
      statsService.recordTaskStats(normalStats);

      const resultWithDryRun = statsService.getStats('all', true);
      const resultWithoutDryRun = statsService.getStats('all', false);

      expect(resultWithDryRun.totalAiCalls).toBe(15);
      expect(resultWithoutDryRun.totalAiCalls).toBe(10);
    });
  });

  describe('getTaskRecord', () => {
    it('应该返回指定任务记录', () => {
      const stats = {
        taskId: 'target-task',
        startTime: '2024-01-01',
        endTime: '2024-01-01',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats);

      const found = statsService.getTaskRecord('target-task');

      expect(found).not.toBeNull();
      expect(found?.taskId).toBe('target-task');
    });

    it('应该返回 null 当任务不存在时', () => {
      const found = statsService.getTaskRecord('non-existent-task');

      expect(found).toBeNull();
    });
  });

  describe('getTaskDetail (alias)', () => {
    it('应该返回任务详情', () => {
      const stats = {
        taskId: 'detail-task',
        startTime: '2024-01-01',
        endTime: '2024-01-01',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats);

      const detail = statsService.getTaskDetail('detail-task');

      expect(detail).toMatchObject(stats);
    });
  });

  describe('clearAllRecords', () => {
    it('应该清空所有记录', () => {
      const stats = {
        taskId: 'test-clear',
        startTime: '2024-01-01',
        endTime: '2024-01-01',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats);
      expect(statsService.getAllTaskRecords()).toHaveLength(1);

      statsService.clearAllRecords();

      expect(statsService.getAllTaskRecords()).toEqual([]);
    });
  });

  describe('deleteTaskRecord', () => {
    it('应该删除指定任务记录', async () => {
      const stats1 = {
        taskId: 'task-to-delete',
        startTime: '2024-01-01',
        endTime: '2024-01-01',
        aiCalls: 5,
        tokensUsed: 100,
        filesProcessed: 10,
        similarityMatched: 3,
        aiClassified: 7,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      const stats2 = {
        taskId: 'task-to-keep',
        startTime: '2024-01-02',
        endTime: '2024-01-02',
        aiCalls: 3,
        tokensUsed: 60,
        filesProcessed: 6,
        similarityMatched: 2,
        aiClassified: 4,
        fileTypes: {},
        status: 'success' as const,
        dryRun: false,
      };

      statsService.recordTaskStats(stats1);
      statsService.recordTaskStats(stats2);

      await statsService.deleteTask('task-to-delete');

      const allRecords = statsService.getAllTaskRecords();

      expect(allRecords).toHaveLength(1);
      expect(allRecords[0].taskId).toBe('task-to-keep');
    });
  });
});
