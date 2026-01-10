import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileStatusService } from './file-status.service';
import { cleanupTestDir, TEST_TEMP_DIR } from '../utils/test-utils';
import type { ProcessedFile } from '../api-client';
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

describe('FileStatusService', () => {
  let fileStatusService: FileStatusService;
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
    const testLogsDir = path.join(process.cwd(), 'logs', 'tasks');
    try {
      cleanupTestDir(testLogsDir);
    } catch {
      // 忽略清理错误，可能文件正在使用中
    }

    // 创建服务实例
    fileStatusService = new FileStatusService();
  });

  afterEach(() => {
    // 恢复原始工作目录
    process.chdir(originalCwd);
  });

  describe('saveFileList', () => {
    it('应该保存文件列表', async () => {
      const taskId = 'test-task-1';
      const files: ProcessedFile[] = [
        {
          name: 'test1.txt',
          originalPath: '/path/to/test1.txt',
          targetPath: '/target/test1.txt',
          type: '.txt',
          size: '1 KB',
          status: 'pending',
          timestamp: Date.now(),
          taskId,
        },
        {
          name: 'test2.pdf',
          originalPath: '/path/to/test2.pdf',
          targetPath: '/target/test2.pdf',
          type: '.pdf',
          size: '2 KB',
          status: 'pending',
          timestamp: Date.now(),
          taskId,
        },
      ];

      await fileStatusService.saveFileList(taskId, files);

      const savedFiles = await fileStatusService.getTaskFiles(taskId);
      expect(savedFiles).toHaveLength(2);
      expect(savedFiles[0].name).toBe('test1.txt');
      expect(savedFiles[1].name).toBe('test2.pdf');
    });

    it('应该覆盖已存在的文件列表', async () => {
      const taskId = 'test-task-1';
      const files1: ProcessedFile[] = [
        {
          name: 'test1.txt',
          originalPath: '/path/to/test1.txt',
          type: '.txt',
          size: '1 KB',
          status: 'pending',
          timestamp: Date.now(),
          taskId,
        },
      ];

      const files2: ProcessedFile[] = [
        {
          name: 'test2.pdf',
          originalPath: '/path/to/test2.pdf',
          type: '.pdf',
          size: '2 KB',
          status: 'pending',
          timestamp: Date.now(),
          taskId,
        },
      ];

      await fileStatusService.saveFileList(taskId, files1);
      await fileStatusService.saveFileList(taskId, files2);

      const savedFiles = await fileStatusService.getTaskFiles(taskId);
      expect(savedFiles).toHaveLength(1);
      expect(savedFiles[0].name).toBe('test2.pdf');
    });
  });

  describe('getTaskFiles', () => {
    it('应该返回空数组当任务不存在时', async () => {
      const files = await fileStatusService.getTaskFiles('non-existent-task');
      expect(files).toEqual([]);
    });

    it('应该返回保存的文件列表', async () => {
      const taskId = 'test-task-1';
      const files: ProcessedFile[] = [
        {
          name: 'test.txt',
          originalPath: '/path/to/test.txt',
          type: '.txt',
          size: '1 KB',
          status: 'pending',
          timestamp: Date.now(),
          taskId,
        },
      ];

      await fileStatusService.saveFileList(taskId, files);
      const retrievedFiles = await fileStatusService.getTaskFiles(taskId);

      expect(retrievedFiles).toHaveLength(1);
      expect(retrievedFiles[0].name).toBe('test.txt');
    });
  });

  describe('getAllTaskIds', () => {
    it('应该返回空数组当没有任务时', () => {
      // 确保目录完全清空
      const testLogsDir = path.join(process.cwd(), 'logs', 'tasks');
      try {
        cleanupTestDir(testLogsDir);
      } catch (error) {
        // 忽略清理错误
      }

      const taskIds = fileStatusService.getAllTaskIds();
      expect(taskIds).toEqual([]);
    });

    it('应该返回所有任务ID', async () => {
      const task1 = 'test-task-1';
      const task2 = 'test-task-2';

      await fileStatusService.saveFileList(task1, []);
      await fileStatusService.saveFileList(task2, []);

      const taskIds = fileStatusService.getAllTaskIds();
      expect(taskIds).toContain(task1);
      expect(taskIds).toContain(task2);
    });
  });

  describe('taskExists', () => {
    it('应该返回 false 当任务不存在时', () => {
      const exists = fileStatusService.taskExists('non-existent-task');
      expect(exists).toBe(false);
    });

    it('应该返回 true 当任务存在时', async () => {
      const taskId = 'test-task-1';
      await fileStatusService.saveFileList(taskId, []);

      const exists = fileStatusService.taskExists(taskId);
      expect(exists).toBe(true);
    });
  });

  describe('deleteTask', () => {
    it('应该删除任务及其文件', async () => {
      const taskId = 'test-task-1';
      await fileStatusService.saveFileList(taskId, []);

      expect(fileStatusService.taskExists(taskId)).toBe(true);

      await fileStatusService.deleteTask(taskId);

      expect(fileStatusService.taskExists(taskId)).toBe(false);
      const files = await fileStatusService.getTaskFiles(taskId);
      expect(files).toEqual([]);
    });

    it('应该处理删除不存在的任务', async () => {
      await expect(fileStatusService.deleteTask('non-existent-task')).resolves.not.toThrow();
    });
  });
});
