import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fileMoveProcessorService from '@/lib/services/file-move-processor.service';
import { logger } from '@/lib/logger';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/services/file-move.service', () => ({
  FileMoveService: vi.fn().mockImplementation(() => ({
    moveFile: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('@/lib/services/file-processing/file-validator.service', () => ({
  FileValidatorService: vi.fn().mockImplementation(() => ({
    validateFileForProcessing: vi.fn().mockReturnValue({ valid: true }),
  })),
}));

describe('FileMoveProcessorService', () => {
  let service: typeof fileMoveProcessorService.FileMoveProcessorService;
  let mockFileMoveService: any;
  let mockValidator: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new fileMoveProcessorService.FileMoveProcessorService();
    mockFileMoveService = service['fileMoveService'] as any;
    mockValidator = service['validator'] as any;
  });

  describe('constructor', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeInstanceOf(fileMoveProcessorService.FileMoveProcessorService);
    });

    it('应该初始化子服务', () => {
      expect(service['fileMoveService']).toBeDefined();
      expect(service['validator']).toBeDefined();
    });
  });

  describe('batchMoveFiles', () => {
    it('应该批量移动文件到目标目录', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/incoming/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
        {
          name: 'file2.txt',
          originalPath: '/incoming/file2.txt',
          type: 'text/plain',
          size: 512,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      const moveInfos = [
        { fileName: 'file1.pdf', targetDir: 'documents', method: 'similarity' as const },
        { fileName: 'file2.txt', targetDir: 'documents', method: 'ai' as const },
      ];

      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });

      const result = await service.batchMoveFiles(
        'task-123',
        mockFiles as any,
        moveInfos as any,
        false
      );

      expect(result.successfulMoves).toBe(2);
      expect(result.failedMoves).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockFileMoveService.moveFile).toHaveBeenCalledTimes(2);
    });

    it('应该在 dry run 模式下不实际移动文件', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/incoming/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      const moveInfos = [
        { fileName: 'file1.pdf', targetDir: 'documents', method: 'similarity' as const },
      ];

      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });

      const result = await service.batchMoveFiles(
        'task-456',
        mockFiles as any,
        moveInfos as any,
        true
      );

      expect(result.successfulMoves).toBe(0);
      expect(result.failedMoves).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockFileMoveService.moveFile).not.toHaveBeenCalled();
    });

    it('应该处理文件验证失败', async () => {
      const mockFiles = [
        {
          name: 'invalid.pdf',
          originalPath: '/invalid/file.pdf',
          type: 'application/pdf',
          size: 1024,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      const moveInfos = [
        { fileName: 'invalid.pdf', targetDir: 'documents', method: 'similarity' as const },
      ];

      mockValidator.validateFileForProcessing.mockReturnValue({
        valid: false,
        reason: '文件不存在',
      });

      const result = await service.batchMoveFiles(
        'task-789',
        mockFiles as any,
        moveInfos as any,
        false
      );

      expect(result.successfulMoves).toBe(0);
      expect(result.failedMoves).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toMatchObject({
        fileName: 'invalid.pdf',
        error: '文件不存在',
      });
      expect(mockFileMoveService.moveFile).not.toHaveBeenCalled();
    });

    it('应该处理移动操作失败', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/incoming/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
        {
          name: 'file2.txt',
          originalPath: '/incoming/file2.txt',
          type: 'text/plain',
          size: 512,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      const moveInfos = [
        { fileName: 'file1.pdf', targetDir: 'documents', method: 'similarity' as const },
        { fileName: 'file2.txt', targetDir: 'documents', method: 'ai' as const },
      ];

      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });

      const moveError = new Error('Move failed');
      mockFileMoveService.moveFile.mockRejectedValue(moveError);

      const result = await service.batchMoveFiles(
        'task-123',
        mockFiles as any,
        moveInfos as any,
        false
      );

      expect(result.successfulMoves).toBe(0);
      expect(result.failedMoves).toBe(2);
      expect(result.errors.length).toBe(2);
    });

    it('应该处理目录更新', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/incoming/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
      ];

      const moveInfos = [
        { fileName: 'file1.pdf', targetDir: 'new-folder', method: 'similarity' as const },
      ];

      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });

      await service.batchMoveFiles(
        'task-999',
        mockFiles as any,
        moveInfos as any,
        false,
        'new-folder'
      );

      expect(mockFileMoveService.moveFile).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          onDirectoryUpdated: 'new-folder',
        })
      );
    });

    it('应该返回详细的移动结果', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/incoming/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
        {
          name: 'file2.txt',
          originalPath: '/incoming/file2.txt',
          type: 'text/plain',
          size: 512,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
      ];
      const moveInfos = [
        { fileName: 'file1.pdf', targetDir: 'documents', method: 'similarity' as const },
        { fileName: 'file2.txt', targetDir: 'images', method: 'ai' as const, score: 0.95 },
      ];

      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });
      mockFileMoveService.moveFile.mockResolvedValue({ success: true });

      const result = await service.batchMoveFiles(
        'task-result',
        mockFiles as any,
        moveInfos as any,
        false
      );

      expect(result.successfulMoves).toBe(2);
      expect(result.failedMoves).toBe(0);
    });

    it('应该记录批量移动操作开始', () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/incoming/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
      ];

      const moveInfos = [
        { fileName: 'file1.pdf', targetDir: 'documents', method: 'similarity' as const },
      ];

      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });

      service.batchMoveFiles('task-start', mockFiles as any, moveInfos as any, false);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-start',
          filesCount: 1,
        })
      );
    });

    it('应该记录批量移动操作完成', async () => {
      const mockFiles = [
        {
          name: 'file1.pdf',
          originalPath: '/incoming/file1.pdf',
          type: 'application/pdf',
          size: 1024,
          status: 'pending' as const,
          processStage: 'scan' as const,
          progress: 0,
        },
      ];

      const moveInfos = [
        { fileName: 'file1.pdf', targetDir: 'documents', method: 'similarity' as const },
      ];

      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });
      mockFileMoveService.moveFile.mockResolvedValue({ success: true });

      const result = await service.batchMoveFiles(
        'task-complete',
        mockFiles as any,
        moveInfos as any,
        false
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-complete',
          successfulMoves: 1,
          failedMoves: 0,
          totalFiles: 1,
        })
      );
    });

    it('应该处理空文件列表', async () => {
      const result = await service.batchMoveFiles('task-empty', [], [], false);

      expect(result.successfulMoves).toBe(0);
      expect(result.failedMoves).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockFileMoveService.moveFile).not.toHaveBeenCalled();
    });
  });

  describe('依赖关系', () => {
    it('应该在构造函数中初始化子服务', () => {
      const instance = new fileMoveProcessorService.FileMoveProcessorService();

      expect(instance['fileMoveService']).toBeDefined();
      expect(instance['validator']).toBeDefined();
    });

    it('应该使用相同的 FileMoveService 实例', () => {
      const instance1 = new fileMoveProcessorService.FileMoveProcessorService();
      const instance2 = new fileMoveProcessorService.FileMoveProcessorService();

      expect(instance1['fileMoveService']).toBe(instance2['fileMoveService']);
    });
  });
});
