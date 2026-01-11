import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileMoveProcessorService } from '@/lib/services/file-move-processor.service';
import { FileMoveService } from '@/lib/services/file-move.service';
import { FileValidatorService } from '@/lib/services/file-processing/file-validator.service';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/services/file-move.service');
vi.mock('@/lib/services/file-processing/file-validator.service', () => {
  class MockFileValidatorService {
    validateSafePath = vi.fn().mockReturnValue({ valid: true });
  }

  return {
    FileValidatorService: MockFileValidatorService,
  };
});

describe('FileMoveProcessorService', () => {
  let service: FileMoveProcessorService;
  let mockFileMoveService: FileMoveService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileMoveService = new FileMoveService();
    service = new FileMoveProcessorService(mockFileMoveService);
  });

  describe('constructor', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeInstanceOf(FileMoveProcessorService);
    });

    it('应该初始化子服务', () => {
      expect((service as any).fileMoveService).toBeDefined();
      expect((service as any).validator).toBeDefined();
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
        {
          fileName: 'file1.pdf',
          sourcePath: '/incoming/file1.pdf',
          targetDir: 'documents',
          method: 'similarity' as const,
        },
        {
          fileName: 'file2.txt',
          sourcePath: '/incoming/file2.txt',
          targetDir: 'documents',
          method: 'ai' as const,
        },
      ];

      vi.mocked(mockFileMoveService.moveFile).mockResolvedValue({
        success: true,
        finalPath: '/documents/file1.pdf',
      });

      const result = await service.batchMoveFiles('task-123', mockFiles as any, moveInfos, false);

      expect(result.successfulMoves).toBe(2);
      expect(result.failedMoves).toBe(0);
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
        {
          fileName: 'file1.pdf',
          sourcePath: '/incoming/file1.pdf',
          targetDir: 'documents',
          method: 'similarity' as const,
        },
      ];

      const result = await service.batchMoveFiles('task-123', mockFiles as any, moveInfos, true);

      expect(mockFileMoveService.moveFile).not.toHaveBeenCalled();
      expect(result.successfulMoves).toBe(1);
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
      ];
      const moveInfos = [
        {
          fileName: 'file1.pdf',
          sourcePath: '/incoming/file1.pdf',
          targetDir: 'documents',
          method: 'similarity' as const,
        },
      ];

      vi.mocked(mockFileMoveService.moveFile).mockResolvedValue({
        success: false,
        finalPath: '',
        error: 'Move failed',
      });

      const result = await service.batchMoveFiles('task-123', mockFiles as any, moveInfos, false);

      expect(result.successfulMoves).toBe(0);
      expect(result.failedMoves).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it('应该处理空文件列表', async () => {
      const result = await service.batchMoveFiles('task-123', [], [], false);

      expect(result.successfulMoves).toBe(0);
      expect(result.failedMoves).toBe(0);
      expect(mockFileMoveService.moveFile).not.toHaveBeenCalled();
    });
  });

  describe('依赖关系', () => {
    it('应该在构造函数中初始化子服务', () => {
      const newService = new FileMoveProcessorService(mockFileMoveService);

      expect((newService as any).fileMoveService).toBe(mockFileMoveService);
      expect((newService as any).validator).toBeInstanceOf(FileValidatorService);
    });

    it('应该使用相同的 FileMoveService 实例', () => {
      const newService1 = new FileMoveProcessorService(mockFileMoveService);
      const newService2 = new FileMoveProcessorService(mockFileMoveService);

      expect((newService1 as any).fileMoveService).toBe((newService2 as any).fileMoveService);
    });
  });
});
