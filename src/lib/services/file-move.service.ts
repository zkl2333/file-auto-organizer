import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';
import { FileValidatorService } from './file-processing/file-validator.service';

/**
 * 文件移动服务
 */
export class FileMoveService {
  private validator: FileValidatorService;

  constructor() {
    this.validator = new FileValidatorService();
  }

  /**
   * 确保目标目录存在
   */
  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.debug({ module: 'file-move', dirPath }, '创建目录');
    }
  }

  /**
   * 生成唯一文件名（如果目标文件已存在）
   */
  private generateUniqueFilename(targetPath: string): string {
    if (!fs.existsSync(targetPath)) {
      return targetPath;
    }

    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const basename = path.basename(targetPath, ext);

    let counter = 1;
    let newPath = path.join(dir, `${basename}(${counter})${ext}`);

    while (fs.existsSync(newPath)) {
      counter++;
      newPath = path.join(dir, `${basename}(${counter})${ext}`);
    }

    logger.debug({ module: 'file-move', originalPath: targetPath, newPath }, '生成唯一文件名');

    return newPath;
  }

  /**
   * 移动文件
   */
  async moveFile(
    sourcePath: string,
    targetPath: string,
    options: { overwrite?: boolean } = {}
  ): Promise<{ success: boolean; finalPath: string; error?: string }> {
    try {
      // 验证源文件
      const sourceValidation = this.validator.validateFile(sourcePath);
      if (!sourceValidation.valid) {
        logger.warn(
          { module: 'file-move', sourcePath, error: sourceValidation.error },
          '源文件验证失败，跳过移动'
        );
        return {
          success: false,
          finalPath: targetPath,
          error: sourceValidation.error,
        };
      }

      // 验证目标目录路径和写入权限
      const targetDir = path.dirname(targetPath);
      const targetDirValidation = this.validator.validateDirectoryWritePermission(targetDir);
      if (!targetDirValidation.valid) {
        logger.warn(
          { module: 'file-move', targetDir, error: targetDirValidation.error },
          '目标目录验证失败，跳过移动'
        );
        return {
          success: false,
          finalPath: targetPath,
          error: targetDirValidation.error,
        };
      }

      // 确保目标目录存在
      this.ensureDir(targetDir);

      // 如果不允许覆盖，生成唯一文件名
      const finalPath = options.overwrite ? targetPath : this.generateUniqueFilename(targetPath);

      // 移动文件
      fs.renameSync(sourcePath, finalPath);

      logger.debug(
        {
          module: 'file-move',
          sourcePath,
          finalPath,
          overwrite: options.overwrite,
        },
        '文件移动成功'
      );

      return { success: true, finalPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          module: 'file-move',
          error,
          sourcePath,
          targetPath,
        },
        `文件移动失败: ${errorMessage}`
      );

      return {
        success: false,
        finalPath: targetPath,
        error: errorMessage,
      };
    }
  }

  /**
   * 复制文件（用于 dry run 模式）
   */
  async copyFile(
    sourcePath: string,
    targetPath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 验证源文件
      const sourceValidation = this.validator.validateFile(sourcePath);
      if (!sourceValidation.valid) {
        logger.warn(
          { module: 'file-move', sourcePath, error: sourceValidation.error },
          '源文件验证失败，跳过复制'
        );
        return {
          success: false,
          error: sourceValidation.error,
        };
      }

      // 验证目标目录路径和写入权限
      const targetDir = path.dirname(targetPath);
      const targetDirValidation = this.validator.validateDirectoryWritePermission(targetDir);
      if (!targetDirValidation.valid) {
        logger.warn(
          { module: 'file-move', targetDir, error: targetDirValidation.error },
          '目标目录验证失败，跳过复制'
        );
        return {
          success: false,
          error: targetDirValidation.error,
        };
      }

      // 确保目标目录存在
      this.ensureDir(targetDir);

      // 复制文件
      fs.copyFileSync(sourcePath, targetPath);

      logger.debug(
        {
          module: 'file-move',
          sourcePath,
          targetPath,
        },
        '文件复制成功（dry run）'
      );

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          module: 'file-move',
          error,
          sourcePath,
          targetPath,
        },
        `文件复制失败: ${errorMessage}`
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 检查文件是否存在
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 获取文件大小
   */
  getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      logger.warn({ module: 'file-move', filePath, error }, '获取文件大小失败');
      return 0;
    }
  }
}
