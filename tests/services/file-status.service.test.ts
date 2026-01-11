import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fileStatusService from '@/lib/services/file-status.service';
import fs from 'node:fs';
import path from 'node:path';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

describe('FileStatusService', () => {
  let service: typeof fileStatusService.FileStatusService;
  const testTasksDir = path.join(process.cwd(), 'tests', 'fixtures', 'file-status-test');

  beforeEach(() => {
    vi.clearAllMocks();
    service = new fileStatusService.FileStatusService();
  });

  describe('constructor', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeInstanceOf(fileStatusService.FileStatusService);
    });

    it('应该创建 tasks 目录', () => {
      expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
        expect.stringContaining('file-status-test'),
        { recursive: true }
      );
    });
  });

  describe('saveFileList', () => {
    it('应该保存文件列表到磁盘', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/path/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          timestamp: 1234567890,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
        {
          name: 'file2.txt',
          originalPath: '/path/file2.txt',
          type: 'text/plain',
          size: 512,
          timestamp: 1234567891,
          status: 'completed',
          processStage: 'complete' as const,
          progress: 100,
        },
      ];

      await service.saveFileList('task-123', mockFiles as any);

      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.stringContaining('task-123'),
        JSON.stringify(mockFiles, null, 2),
        'utf-8'
      );
      expect(vi.mocked(fs.existsSync)).toHaveBeenCalledWith(expect.stringContaining('task-123'));
    });

    it('应该创建任务目录如果不存在', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await service.saveFileList('task-456', []);

      expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(expect.stringContaining('task-456'), {
        recursive: true,
      });
    });

    it('应该记录保存成功', async () => {
      const mockFiles = [
        {
          name: 'test.pdf',
          originalPath: '/test.pdf',
          type: 'application/pdf',
          size: 1024,
          timestamp: 1234567890,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      await service.saveFileList('task-789', mockFiles as any);

      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.stringContaining('task-789'),
        JSON.stringify(mockFiles, null, 2),
        'utf-8'
      );
    });
  });

  describe('getTaskFiles', () => {
    it('应该返回任务文件列表', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/path/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          timestamp: 1234567890,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockFiles));

      const files = await service.getTaskFiles('task-123');

      expect(files).toEqual(mockFiles);
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith(
        expect.stringContaining('task-123'),
        'utf-8'
      );
    });

    it('应该返回空数组当文件不存在时', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const files = await service.getTaskFiles('non-existent-task');

      expect(files).toEqual([]);
      expect(vi.mocked(fs.existsSync)).toHaveBeenCalledWith(
        expect.stringContaining('non-existent-task')
      );
    });

    it('应该处理文件列表解析错误', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json{{{');

      const files = await service.getTaskFiles('task-error');

      expect(files).toEqual([]);
    });
  });

  describe('updateAndSaveFileStatus', () => {
    it('应该更新单个文件状态并保存', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/path/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          timestamp: 1234567890,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
        {
          name: 'file2.txt',
          originalPath: '/path/file2.txt',
          type: 'text/plain',
          size: 512,
          timestamp: 1234567891,
          status: 'completed',
          processStage: 'complete' as const,
          progress: 100,
        },
      ];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockFiles));
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      await service.updateAndSaveFileStatus('task-123', 'file1.pdf', {
        status: 'completed',
        processStage: 'move',
        progress: 100,
      });

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData[0]).toMatchObject({
        ...mockFiles[0],
        status: 'completed',
        processStage: 'move',
        progress: 100,
      });
    });

    it('应该批量更新文件状态', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/path/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          timestamp: 1234567890,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
        {
          name: 'file2.txt',
          originalPath: '/path/file2.txt',
          type: 'text/plain',
          size: 512,
          timestamp: 1234567891,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
        {
          name: 'file3.jpg',
          originalPath: '/path/file3.jpg',
          type: 'image/jpeg',
          size: 2048,
          timestamp: 1234567892,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockFiles));
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const updates = [
        { fileName: 'file2.txt', status: 'completed' },
        { fileName: 'file3.jpg', processStage: 'ai' },
      ];

      await service.batchUpdateFilesToStatus(
        'task-456',
        mockFiles as any,
        ['file2.txt', 'file3.jpg'],
        'completed',
        'ai',
        0
      );

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData[1]).toMatchObject({
        ...mockFiles[1],
        status: 'completed',
      });
      expect(writtenData[2]).toMatchObject({
        ...mockFiles[2],
        processStage: 'ai',
      });
    });
  });

  describe('batchUpdateAndSaveFileStatus', () => {
    it('应该批量更新并保存多个文件状态', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/path/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          timestamp: 1234567890,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
        {
          name: 'file2.txt',
          originalPath: '/path/file2.txt',
          type: 'text/plain',
          size: 512,
          timestamp: 1234567891,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockFiles));
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      await service.batchUpdateAndSaveFileStatus('task-789', mockFiles as any);

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData[0]).toMatchObject({
        ...mockFiles[0],
        status: 'completed',
      });
      expect(writtenData[1]).toMatchObject({
        ...mockFiles[1],
        status: 'completed',
      });
    });
  });

  describe('getAllTaskIds', () => {
    it('应该返回所有任务ID列表', () => {
      const mockEntries = ['task-1', 'task-2', 'task-3'];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(
        mockEntries.map((id) => ({ name: id, isDirectory: () => true }))
      );

      const taskIds = service.getAllTaskIds();

      expect(taskIds).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('应该按时间倒序返回任务ID', () => {
      const mockEntries = ['task-recent', 'task-old', 'task-oldest'];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(
        mockEntries.map((id) => ({ name: id, isDirectory: () => true }))
      );

      const taskIds = service.getAllTaskIds();

      expect(taskIds).toEqual(['task-oldest', 'task-old', 'task-recent']);
    });

    it('应该返回空数组当没有任务时', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const taskIds = service.getAllTaskIds();

      expect(taskIds).toEqual([]);
    });
  });

  describe('taskExists', () => {
    it('应该返回 true 当任务目录存在时', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['task-123']);

      const exists = service.taskExists('task-123');

      expect(exists).toBe(true);
    });

    it('应该返回 false 当任务目录不存在时', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const exists = service.taskExists('non-existent-task');

      expect(exists).toBe(false);
    });
  });

  describe('deleteTask', () => {
    it('应该删除任务目录和所有文件', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/path/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          timestamp: 1234567890,
          status: 'pending',
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['task-123']);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockFiles));
      vi.mocked(fs.rmSync).mockReturnValue(undefined);

      await service.deleteTask('task-123');

      expect(vi.mocked(fs.rmSync)).toHaveBeenCalledWith(expect.stringContaining('task-123'), {
        recursive: true,
        force: true,
      });
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-123',
        })
      );
    });

    it('应该处理任务目录不存在的情况', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await service.deleteTask('non-existent-task');

      expect(vi.mocked(fs.rmSync)).not.toHaveBeenCalled();
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'non-existent-task',
        })
      );
    });

    it('应该处理删除错误', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Readdir failed');
      });

      await expect(service.deleteTask('task-error')).rejects.toThrow();
    });

    it('应该记录删除错误', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['task-error']);
      vi.mocked(fs.rmSync).mockReturnValue(undefined);

      try {
        await service.deleteTask('task-error');
      } catch (error) {
        expect(error).toBeDefined();
      }

      expect(vi.mocked(logger.error)).toHaveBeenCalled();
    });
  });
});
