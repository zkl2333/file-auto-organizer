import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as logService from '@/lib/services/log.service';
import fs from 'node:fs';
import { getConfig } from '@/lib/config';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('node:fs');
vi.mock('@/lib/config');

const mockedFs = vi.mocked(fs);
const mockedGetConfig = vi.mocked(getConfig);

describe('LogService', () => {
  const testDir = '/test/logs';

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetConfig.mockReturnValue({
      logging: { level: 'info', dir: testDir },
      openai: { api_key: 'test', model: 'test', base_url: 'test' },
      directories: { root_dir: '', incoming_dir: '' },
      cron: { enabled: false, schedule: '' },
      timezone: '',
      scan: { max_depth: 0, similarity_threshold: 0 },
      ai: { batch_size: 0 },
      file_operations: { max_retries: 0, retry_delay_base: 0 },
    });
  });

  describe('readLogFiles', () => {
    it('应该返回空数组当日志目录不存在时', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const logs = await logService.readLogFiles(100);

      expect(logs).toEqual([]);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
    });

    it('应该返回空数组当日志目录为空时', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([]);

      const logs = await logService.readLogFiles(100);

      expect(logs).toEqual([]);
    });

    it('应该读取最新的日志文件', async () => {
      const logContent = 'log line 1\nlog line 2\nlog line 3';
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue(['app-2026-01-10.log', 'app-2026-01-11.log']);
      mockedFs.readFileSync.mockReturnValue(logContent);

      const logs = await logService.readLogFiles(100);

      expect(logs).toContain('log line 1');
      expect(logs).toContain('log line 2');
      expect(logs).toContain('log line 3');
    });

    it('应该限制返回的行数', async () => {
      const manyLines = Array.from({ length: 200 }, (_, i) => `log line ${i}`).join('\n');
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue(['app.log']);
      mockedFs.readFileSync.mockReturnValue(manyLines);

      const logs = await logService.readLogFiles(10);

      expect(logs.length).toBeLessThanOrEqual(10);
    });

    it('应该处理读取错误', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const logs = await logService.readLogFiles(100);

      expect(logs).toEqual([]);
    });

    it('应该包含 app.log 文件', async () => {
      const logContent = 'current log';
      mockedFs.existsSync.mockImplementation((path) => {
        if (typeof path === 'string' && path.endsWith('app.log')) return true;
        return false;
      });
      mockedFs.readdirSync.mockReturnValue([]);
      mockedFs.readFileSync.mockReturnValue(logContent);

      const logs = await logService.readLogFiles(100);

      expect(logs).toContain('current log');
    });
  });

  describe('getLogFileInfo', () => {
    it('应该返回不存在的目录信息', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const info = logService.getLogFileInfo();

      expect(info.exists).toBe(false);
      expect(info.size).toBe(0);
      expect(info.lines).toBe(0);
    });

    it('应该返回正确的文件信息', () => {
      const mockStats = { size: 1024, mtime: new Date() };
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue(['app-2026-01-11.log']);
      mockedFs.statSync.mockReturnValue(mockStats as any);
      mockedFs.readFileSync.mockReturnValue('line1\nline2\nline3');

      const info = logService.getLogFileInfo();

      expect(info.exists).toBe(true);
      expect(info.size).toBeGreaterThan(0);
      expect(info.lines).toBe(3);
      expect(info.fileCount).toBe(1);
    });

    it('应该处理多个日志文件', () => {
      const mockStats = { size: 1024, mtime: new Date() };
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue(['app-2026-01-10.log', 'app-2026-01-11.log', 'app.log']);
      mockedFs.statSync.mockReturnValue(mockStats as any);
      mockedFs.readFileSync.mockReturnValue('line1\nline2');

      const info = logService.getLogFileInfo();

      expect(info.fileCount).toBe(3);
      expect(info.lines).toBe(6);
    });

    it('应该处理错误', () => {
      mockedFs.existsSync.mockImplementation(() => {
        throw new Error('Error');
      });

      const info = logService.getLogFileInfo();

      expect(info.exists).toBe(false);
      expect(info.error).toBeDefined();
    });
  });

  describe('cleanupOldLogs', () => {
    it('应该处理不存在的目录', () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => logService.cleanupOldLogs(30)).not.toThrow();
    });

    it('应该删除旧的日志文件', () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      const newDate = new Date();
      const oldFile = 'app-2025-12-01.log';
      const newFile = 'app-2026-01-11.log';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([oldFile, newFile] as any);
      mockedFs.statSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes(oldFile)) {
          return { isFile: () => true, mtime: oldDate } as any;
        }
        return { isFile: () => true, mtime: newDate } as any;
      });

      logService.cleanupOldLogs(30);

      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(oldFile));
    });

    it('应该清理旧的任务文件', () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const entry = { name: 'task123', isDirectory: () => true };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([entry] as any);
      mockedFs.statSync.mockReturnValue({ mtime: oldDate } as any);

      logService.cleanupOldLogs(30);

      expect(mockedFs.rmSync).toHaveBeenCalled();
    });

    it('应该处理清理错误', () => {
      mockedFs.existsSync.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      expect(() => logService.cleanupOldLogs(30)).not.toThrow();
    });
  });
});
