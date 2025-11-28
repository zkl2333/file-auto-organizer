import fs from "node:fs";
import path from "node:path";
import { fileScanLogger } from "../logger.js";
import { config } from "../config.js";

const { MAX_SCAN_DEPTH } = config;

export class FileScanService {
  /**
   * 扫描目录树，返回相对路径的目录列表
   */
  scanDirs(rootDir: string): string[] {
    const result: string[] = [];

    function walk(dir: string, base: string = "", depth: number = 0): void {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relPath = path.join(base, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          result.push(relPath + "/");
          if (depth < MAX_SCAN_DEPTH) {
            walk(fullPath, relPath, depth + 1);
          }
        }
      }
    }

    if (fs.existsSync(rootDir)) {
      walk(rootDir);
      fileScanLogger.debug({ dirs: result.length }, "扫描目录完成");
    } else {
      fileScanLogger.warn({ rootDir }, "根目录不存在");
    }
    return result;
  }

  /**
   * 递归扫描所有文件，返回相对 ROOT_DIR 的路径
   */
  scanFiles(rootDir: string): string[] {
    const result: string[] = [];

    function walk(dir: string, base: string = "", depth: number = 0): void {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relPath = path.join(base, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (depth < MAX_SCAN_DEPTH) {
            walk(fullPath, relPath, depth + 1);
          }
        } else if (stat.isFile()) {
          result.push(relPath);
        }
      }
    }

    if (fs.existsSync(rootDir)) {
      walk(rootDir);
      fileScanLogger.debug({ files: result.length }, "扫描文件完成");
    } else {
      fileScanLogger.warn({ rootDir }, "根目录不存在");
    }
    return result;
  }

  /**
   * 获取待分类目录中的文件列表
   */
  getIncomingFiles(incomingDir: string): string[] {
    if (!fs.existsSync(incomingDir)) {
      fileScanLogger.warn({ incomingDir }, "待分类目录不存在");
      return [];
    }

    const files = fs.readdirSync(incomingDir);
    const fileList = files.filter((f) => fs.statSync(path.join(incomingDir, f)).isFile());
    fileScanLogger.debug({ files: fileList.length }, "扫描待分类文件完成");
    return fileList;
  }
}
