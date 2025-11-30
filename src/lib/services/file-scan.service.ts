import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/lib/logger';
import { getConfig } from '@/lib/config';

/**
 * 文件扫描服务
 */
export class FileScanService {
  private maxDepth: number;

  constructor() {
    const config = getConfig();
    this.maxDepth = config.scan.max_depth;
  }

  /**
   * 扫描目录树，返回相对路径的目录列表
   */
  scanDirs(rootDir: string): string[] {
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
