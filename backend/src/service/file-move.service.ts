import fs from "node:fs";
import path from "node:path";
import { fileMoveLogger } from "../logger.js";
import { config } from "../config.js";

const { FILE_MAX_RETRIES, FILE_RETRY_DELAY_BASE, DRY_RUN } = config;

export class FileMoveService {
  /**
   * 确保目录存在，如果不存在则创建
   */
  ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 为目标路径生成一个不会与现有文件冲突的唯一路径
   */
  private generateUniqueTargetPath(targetDir: string, originalFilePath: string): string {
    const ext = path.extname(originalFilePath);
    const name = path.basename(originalFilePath, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    let candidate = path.join(targetDir, `${name}_${timestamp}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    // 如果时间戳仍冲突，追加随机数
    let counter = 1;
    while (true) {
      candidate = path.join(targetDir, `${name}_${timestamp}_${counter}${ext}`);
      if (!fs.existsSync(candidate)) return candidate;
      counter++;
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 递归删除源文件：对占用类错误进行指数退避重试
   */
  private async unlinkWithRetryRecursive(src: string, finalPath: string, attempt: number = 1): Promise<void> {
    try {
      fs.unlinkSync(src);
      return;
    } catch (err: any) {
      if ((err?.code === "EBUSY" || err?.code === "EACCES" || err?.code === "EPERM") && attempt < FILE_MAX_RETRIES) {
        const delay = FILE_RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        fileMoveLogger.warn({ src, finalPath, attempt, delay, error: err.message }, "源文件占用，等待删除重试");
        await this.sleep(delay);
        return this.unlinkWithRetryRecursive(src, finalPath, attempt + 1);
      }
      throw err;
    }
  }

  /**
   * 跨设备回退：复制到目标目录下的临时文件 → 校验 → 原子重命名为最终名 → 删除源文件（含退避重试）
   */
  private async copyThenUnlinkWithFinalize(
    src: string,
    targetDir: string,
    desiredTargetPath: string
  ): Promise<string> {
    const ext = path.extname(src);
    const base = path.basename(src, ext);
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const tempPath = path.join(targetDir, `${base}.tmp-${uniqueSuffix}${ext}`);

    // 复制（尽量保留时间戳；Node 16+ 支持 cpSync）
    if ((fs as any).cpSync) {
      (fs as any).cpSync(src, tempPath, { preserveTimestamps: true, errorOnExist: false, force: true });
    } else {
      fs.copyFileSync(src, tempPath);
    }

    // 简单校验：大小一致
    const srcStat = fs.statSync(src);
    const tmpStat = fs.statSync(tempPath);
    if (srcStat.size !== tmpStat.size) {
      try { fs.unlinkSync(tempPath); } catch {}
      throw new Error("copy-verify-failed: size-mismatch");
    }

    // 目标若已存在，生成唯一名；随后在同目录下原子 rename 临时文件
    let finalPath = desiredTargetPath;
    if (fs.existsSync(finalPath)) {
      finalPath = this.generateUniqueTargetPath(targetDir, src);
    }

    try {
      fs.renameSync(tempPath, finalPath);
    } catch (e: any) {
      if (e?.code === "EEXIST") {
        finalPath = this.generateUniqueTargetPath(targetDir, src);
        fs.renameSync(tempPath, finalPath);
      } else {
        try { fs.unlinkSync(tempPath); } catch {}
        throw e;
      }
    }

    // 删除源文件（递归退避）
    await this.unlinkWithRetryRecursive(src, finalPath, 1);
    return finalPath;
  }

  /**
   * 递归移动：rename 优先，EEXIST 唯一名重试，EXDEV 回退复制+删除，
   * 占用类错误递归退避重试，ENOENT 视为已处理。
   */
  private async attemptMoveRecursive(file: string, targetDir: string, desiredTargetPath: string, attempt: number = 1): Promise<void> {
    try {
      fs.renameSync(file, desiredTargetPath);
      fileMoveLogger.info({ from: file, to: desiredTargetPath }, "文件已移动");
      return;
    } catch (err: any) {
      if (err?.code === "EEXIST") {
        const uniquePath = this.generateUniqueTargetPath(targetDir, file);
        return this.attemptMoveRecursive(file, targetDir, uniquePath, attempt);
      }
      if (err?.code === "EXDEV") {
        const finalPath = await this.copyThenUnlinkWithFinalize(file, targetDir, desiredTargetPath);
        fileMoveLogger.info({ from: file, to: finalPath }, "文件已移动（跨设备回退复制）");
        return;
      }
      if (err?.code === "ENOENT") {
        fileMoveLogger.warn({ file }, "源文件不存在，跳过移动");
        return;
      }
      if ((err?.code === "EBUSY" || err?.code === "EACCES" || err?.code === "EPERM") && attempt < FILE_MAX_RETRIES) {
        const delay = FILE_RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        fileMoveLogger.warn({ file, attempt, maxRetries: FILE_MAX_RETRIES, delay, error: err.message }, "文件被占用，等待重试");
        await this.sleep(delay);
        return this.attemptMoveRecursive(file, targetDir, desiredTargetPath, attempt + 1);
      }
      fileMoveLogger.error({ file, desiredTargetPath, error: err?.message }, "文件移动失败");
      throw err;
    }
  }

  /**
   * 移动文件到目标目录
   */
  async moveFile(file: string, targetDir: string): Promise<void> {
    // 归一化：若 targetDir 末段等于文件名，剥离末段，避免目录/文件同名嵌套
    const fileBaseName = path.basename(file);
    const targetDirBase = path.basename(targetDir);
    const normalizedTargetDir = targetDirBase === fileBaseName ? path.dirname(targetDir) : targetDir;
    const targetPath = path.join(normalizedTargetDir, fileBaseName);

    if (DRY_RUN) {
      fileMoveLogger.info(`[dry-run] ${file} -> ${targetDir}`);
      return;
    }

    this.ensureDir(normalizedTargetDir);
    await this.attemptMoveRecursive(file, normalizedTargetDir, targetPath, 1);
  }
}
