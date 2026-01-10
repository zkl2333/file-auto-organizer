import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';
import { getConfig } from '@/lib/config';
import { FileValidatorService } from './file-processing/file-validator.service';

/**
 * 文件扫描服务
 */
export class FileScanService {
  private maxDepth: number;
  private validator: FileValidatorService;

  constructor() {
    const config = getConfig();
    this.maxDepth = config.scan.max_depth;
    this.validator = new FileValidatorService();
  }

  /**
   * 验证目录路径是否安全
   */
  private validateDirectoryPath(dirPath: string): boolean {
    const validation = this.validator.validateSafePath(dirPath, dirPath);
    if (!validation.valid) {
      logger.warn({ dirPath, error: validation.error }, '目录路径验证失败，跳过此目录');
      return false;
    }
    return true;
  }

  /**
   * 扫描目录树，返回相对路径的目录列表
   */
  scanDirs(rootDir: string): string[] {
    // 验证根目录路径安全性
    if (!this.validateDirectoryPath(rootDir)) {
      return [];
    }

    const result: string[] = [];
    const maxDepth = this.maxDepth;

    function walk(dir: string, base: string = '', depth: number = 0): void {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const relPath = path.join(base, entry);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              result.push(relPath + '/');
              if (depth < maxDepth) {
                walk(fullPath, relPath, depth + 1);
              }
            }
          } catch {
            // 忽略无法访问的文件
          }
        }
      } catch {
        // 忽略无法读取的目录
      }
    }

    if (fs.existsSync(rootDir)) {
      walk(rootDir);
      logger.debug({ dirs: result.length }, '扫描目录完成');
    } else {
      logger.warn({ rootDir }, '根目录不存在');
    }
    return result;
  }

  /**
   * 递归扫描所有文件，返回相对 rootDir 的路径
   */
  scanFiles(rootDir: string): string[] {
    // 验证根目录路径安全性
    if (!this.validateDirectoryPath(rootDir)) {
      return [];
    }

    const result: string[] = [];
    const maxDepth = this.maxDepth;

    function walk(dir: string, base: string = '', depth: number = 0): void {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const relPath = path.join(base, entry);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              if (depth < maxDepth) {
                walk(fullPath, relPath, depth + 1);
              }
              // 目录不添加到结果
            } else if (stat.isFile()) {
              result.push(relPath);
            }
          } catch {
            // 忽略无法访问的文件
          }
        }
      } catch {
        // 忽略无法读取的目录
      }
    }

    if (fs.existsSync(rootDir)) {
      walk(rootDir);
      logger.debug({ files: result.length }, '扫描文件完成');
    } else {
      logger.warn({ rootDir }, '根目录不存在');
    }
    return result;
  }

  /**
   * 获取待分类目录中的文件列表
   */
  getIncomingFiles(incomingDir: string): string[] {
    // 验证目录路径安全性
    if (!this.validateDirectoryPath(incomingDir)) {
      return [];
    }

    if (!fs.existsSync(incomingDir)) {
      logger.warn({ incomingDir }, '待分类目录不存在');
      return [];
    }

    try {
      const files = fs.readdirSync(incomingDir);
      const fileList = files.filter((f) => {
        try {
          return fs.statSync(path.join(incomingDir, f)).isFile();
        } catch {
          return false;
        }
      });
      logger.debug({ files: fileList.length }, '扫描待分类文件完成');
      return fileList;
    } catch (error) {
      logger.error({ error, incomingDir }, '扫描待分类目录失败');
      return [];
    }
  }
}
