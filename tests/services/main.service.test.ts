import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MainService } from '@/lib/services/main.service';
import { TEST_TEMP_DIR } from '../utils/test-utils';
import path from 'path';
import fs from 'fs';

// Mock 配置 - 使用函数返回配置，动态获取路径
vi.mock('@/lib/config', () => ({
  getTaskConfig: vi.fn(() => {
    const cwd = process.cwd();
    return {
      rootDir: path.join(cwd, 'root'),
      incomingDir: path.join(cwd, 'incoming'),
      similarityThreshold: 0.65,
      aiProvider: 'openai',
      aiModel: 'gpt-4',
      enableMove: true,
      enableAI: true,
      enableSimilarityCheck: true,
    };
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  mainLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  setCurrentTaskId: vi.fn(),
  systemLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('MainService', () => {
  let mainService: MainService;
  let incomingDir: string;
  let rootDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // 保存原始工作目录
    originalCwd = process.cwd();

    // 设置测试工作目录
    if (TEST_TEMP_DIR && fs.existsSync(TEST_TEMP_DIR)) {
      process.chdir(TEST_TEMP_DIR);
    }

    // 创建测试目录（确保目录存在）
    incomingDir = path.join(process.cwd(), 'incoming');
    rootDir = path.join(process.cwd(), 'root');

    if (!fs.existsSync(incomingDir)) {
      fs.mkdirSync(incomingDir, { recursive: true });
    }
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }

    // 创建服务实例
    mainService = new MainService();
  });

  afterEach(() => {
    // 恢复原始工作目录
    process.chdir(originalCwd);
  });

  describe('getRunningStatus', () => {
    it('应该返回初始运行状态', () => {
      const status = MainService.getRunningStatus();
      expect(status.isRunning).toBe(false);
      expect(status.taskId).toBeNull();
      expect(status.startTime).toBeNull();
      expect(status.dryRun).toBe(false);
    });
  });

  describe('runOnce', () => {
    it('应该在待分类目录为空时返回成功', async () => {
      // 确保 incoming 目录存在但为空
      if (!fs.existsSync(incomingDir)) {
        fs.mkdirSync(incomingDir, { recursive: true });
      }
      // 清理目录中的文件
      const files = fs.readdirSync(incomingDir);
      files.forEach((file) => {
        try {
          fs.unlinkSync(path.join(incomingDir, file));
        } catch {
          // 忽略删除错误
        }
      });

      const result = await mainService.runOnce(true);

      expect(result.status).toBe('success');
      expect(result.totalProcessed).toBe(0);
      expect(result.taskId).toBeTruthy();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('应该处理待分类目录中的文件', async () => {
      // 确保目录存在
      if (!fs.existsSync(incomingDir)) {
        fs.mkdirSync(incomingDir, { recursive: true });
      }

      // 创建测试文件（使用绝对路径）
      const file1 = path.join(incomingDir, 'test1.txt');
      const file2 = path.join(incomingDir, 'test2.pdf');
      const file3 = path.join(incomingDir, 'test3.jpg');

      fs.writeFileSync(file1, 'test content 1', 'utf-8');
      fs.writeFileSync(file2, 'test content 2', 'utf-8');
      fs.writeFileSync(file3, 'test content 3', 'utf-8');

      const result = await mainService.runOnce(true);

      expect(result.status).toBe('success');
      expect(result.totalProcessed).toBeGreaterThan(0);
      expect(result.taskId).toBeTruthy();
      expect(result.fileTypes).toBeDefined();
    });

    it('应该在 dryRun 模式下不实际移动文件', async () => {
      // 创建测试文件（使用绝对路径）
      const filePath = path.join(incomingDir, 'test.txt');
      fs.writeFileSync(filePath, 'test content', 'utf-8');

      const result = await mainService.runOnce(true);

      expect(result.status).toBe('success');
      // 文件应该还在 incoming 目录（dryRun 模式下不移动文件）
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('getTaskFiles', () => {
    it('应该返回空数组当任务不存在时', async () => {
      const files = await mainService.getTaskFiles('non-existent-task');
      expect(files).toEqual([]);
    });
  });

  describe('getTaskDetail', () => {
    it('应该返回 null 当任务不存在时', async () => {
      const detail = await mainService.getTaskDetail('non-existent-task');
      expect(detail).toBeNull();
    });
  });

  describe('getTaskLogs', () => {
    it('应该返回空数组当日志文件不存在时', async () => {
      const logs = await mainService.getTaskLogs('non-existent-task', 'main', 100);
      expect(logs).toEqual([]);
    });
  });

  describe('deleteTask', () => {
    it('应该成功删除任务', async () => {
      // 先创建一个任务
      const result = await mainService.runOnce(true);
      const taskId = result.taskId;

      // 删除任务
      const deleteResult = await mainService.deleteTask(taskId);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.message).toContain('成功');
    });

    it('应该处理删除不存在的任务', async () => {
      const deleteResult = await mainService.deleteTask('non-existent-task');
      // 删除不存在的任务应该也返回成功（幂等性）
      expect(deleteResult.success).toBe(true);
    });
  });
});
