import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileInfoService, cleanupFileInfo } from '@/lib/services/file-info.service';
import { FileMetadataService, FileValidatorService } from '@/lib/services/file-processing';

// Mock file-processing module
vi.mock('@/lib/services/file-processing', () => ({
  FileMetadataService: vi.fn().mockImplementation(() => ({
    getFileDescription: vi.fn(),
    cleanupExiftool: vi.fn().mockResolvedValue(undefined),
  })),
  FileValidatorService: vi.fn().mockImplementation(() => ({
    validateFileForProcessing: vi.fn(),
  })),
}));

describe('FileInfoService', () => {
  let service: FileInfoService;
  let mockFileMetadataService: any;
  let mockValidator: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (FileInfoService as any).instance = null;
    service = FileInfoService.getInstance();
    mockFileMetadataService = (service as any).fileMetadata;
    mockValidator = (service as any).validator;
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = FileInfoService.getInstance();
      const instance2 = FileInfoService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('应该初始化所有子服务', () => {
      expect(FileMetadataService).toHaveBeenCalled();
      expect(FileValidatorService).toHaveBeenCalled();
    });
  });

  describe('getFileDescription', () => {
    it('应该成功获取文件描述', async () => {
      const testPath = '/test/file.txt';
      const description = 'test description';
      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });
      mockFileMetadataService.getFileDescription.mockResolvedValue(description);

      const result = await service.getFileDescription(testPath);

      expect(result).toBe(description);
      expect(mockValidator.validateFileForProcessing).toHaveBeenCalledWith(testPath);
      expect(mockFileMetadataService.getFileDescription).toHaveBeenCalledWith(testPath);
    });

    it('应该在验证失败时返回空字符串', async () => {
      const testPath = '/test/file.txt';
      mockValidator.validateFileForProcessing.mockReturnValue({
        valid: false,
        reason: 'invalid file',
      });

      const result = await service.getFileDescription(testPath);

      expect(result).toBe('');
      expect(mockFileMetadataService.getFileDescription).not.toHaveBeenCalled();
    });

    it('应该在获取描述失败时返回空字符串', async () => {
      const testPath = '/test/file.txt';
      mockValidator.validateFileForProcessing.mockReturnValue({ valid: true });
      mockFileMetadataService.getFileDescription.mockRejectedValue(new Error('read failed'));

      const result = await service.getFileDescription(testPath);

      expect(result).toBe('');
    });
  });

  describe('cleanup', () => {
    it('应该成功清理资源', async () => {
      await service.cleanup();

      expect(mockFileMetadataService.cleanupExiftool).toHaveBeenCalled();
    });

    it('应该在清理失败时记录警告', async () => {
      mockFileMetadataService.cleanupExiftool.mockRejectedValue(new Error('cleanup failed'));

      await expect(service.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('应该返回性能指标', () => {
      const metrics = service.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });
  });
});

describe('cleanupFileInfo', () => {
  it('应该调用实例的 cleanup 方法', async () => {
    (FileInfoService as any).instance = null;
    const service = FileInfoService.getInstance();
    const cleanupSpy = vi.spyOn(service, 'cleanup').mockResolvedValue(undefined);

    await cleanupFileInfo();

    expect(cleanupSpy).toHaveBeenCalled();
  });
});
