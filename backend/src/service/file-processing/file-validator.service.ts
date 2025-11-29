import fs from "node:fs";
import path from "node:path";
import { fileInfoLogger } from "../../logger.js";

/**
 * 文件验证服务 - 专注于文件验证和权限检查
 * 增强安全性：防止路径遍历攻击、符号链接攻击等
 */
export class FileValidatorService {

  /**
   * 危险文件扩展名黑名单（仅包含可执行文件，不包含源代码文件）
   */
  private static readonly DANGEROUS_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs',
    '.app', '.deb', '.pkg', '.dmg', '.rpm', '.msi', '.msp', '.msu'
  ]);

  /**
   * 不允许的路径模式
   */
  private static readonly FORBIDDEN_PATHS = new Set([
    'System32', 'Windows', 'Program Files', 'Program Files (x86)',
    'Library', 'System', 'usr/bin', 'usr/sbin', 'bin', 'sbin'
  ]);

  /**
   * 检查文件扩展名是否安全
   */
  private isSafeExtension(filePath: string): { safe: boolean; reason?: string } {
    const ext = path.extname(filePath).toLowerCase();

    if (FileValidatorService.DANGEROUS_EXTENSIONS.has(ext)) {
      return { safe: false, reason: `危险文件扩展名: ${ext}` };
    }

    return { safe: true };
  }

  /**
   * 检查路径是否包含系统关键目录
   */
  private containsSystemPaths(filePath: string): { safe: boolean; reason?: string } {
    const normalizedPath = path.normalize(filePath).toLowerCase();

    for (const forbiddenPath of FileValidatorService.FORBIDDEN_PATHS) {
      if (normalizedPath.includes(forbiddenPath.toLowerCase())) {
        return { safe: false, reason: `路径包含系统目录: ${forbiddenPath}` };
      }
    }

    return { safe: true };
  }

  /**
   * 安全地解析符号链接，防止链接循环
   */
  private resolveSymlinks(filePath: string, maxDepth = 10): { safe: boolean; realPath?: string; reason?: string } {
    let currentPath = filePath;
    const visitedPaths = new Set<string>();

    for (let depth = 0; depth < maxDepth; depth++) {
      try {
        const realPath = fs.realpathSync(currentPath);

        // 检查循环链接
        if (visitedPaths.has(realPath)) {
          return { safe: false, reason: "检测到符号链接循环" };
        }

        visitedPaths.add(realPath);
        currentPath = realPath;

        // 如果不再是符号链接，返回真实路径
        if (!fs.lstatSync(currentPath).isSymbolicLink()) {
          return { safe: true, realPath: currentPath };
        }
      } catch (err) {
        return { safe: false, reason: `符号链接解析失败: ${err instanceof Error ? err.message : '未知错误'}` };
      }
    }

    return { safe: false, reason: "符号链接层级过深" };
  }

  /**
   * 检查文件是否可以安全读取（增强版）
   */
  validateFile(filePath: string): { valid: boolean; error?: string; realPath?: string } {
    try {
      // 基本存在性检查
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: "文件不存在" };
      }

      // 安全扩展名检查
      const extCheck = this.isSafeExtension(filePath);
      if (!extCheck.safe) {
        return { valid: false, error: extCheck.reason };
      }

      // 系统路径检查
      const pathCheck = this.containsSystemPaths(filePath);
      if (!pathCheck.safe) {
        return { valid: false, error: pathCheck.reason };
      }

      // 符号链接安全解析
      const symlinkCheck = this.resolveSymlinks(filePath);
      if (!symlinkCheck.safe) {
        return { valid: false, error: symlinkCheck.reason };
      }

      const realPath = symlinkCheck.realPath!;
      const stats = fs.statSync(realPath);

      if (!stats.isFile()) {
        return { valid: false, error: "不是有效的文件" };
      }

      if (stats.size === 0) {
        return { valid: false, error: "文件为空" };
      }

      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (stats.size > maxSize) {
        return { valid: false, error: `文件过大 (${(stats.size / 1024 / 1024).toFixed(0)}MB)` };
      }

      try {
        fs.accessSync(realPath, fs.constants.R_OK);
      } catch {
        return { valid: false, error: "文件读取权限不足" };
      }

      return { valid: true, realPath };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "文件验证失败" };
    }
  }

  /**
   * 检查文件大小是否在限制范围内
   */
  validateFileSize(filePath: string, maxSize: number): { valid: boolean; size?: number; error?: string } {
    try {
      const stats = fs.statSync(filePath);
      const size = stats.size;

      if (size > maxSize) {
        return {
          valid: false,
          size,
          error: `文件过大 (${(size / 1024 / 1024).toFixed(2)}MB)，最大支持 ${(maxSize / 1024 / 1024).toFixed(2)}MB`
        };
      }

      if (size === 0) {
        return { valid: false, size, error: "文件为空" };
      }

      return { valid: true, size };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "无法获取文件大小" };
    }
  }

  /**
   * 检查文件是否为普通文件（不是目录或特殊文件）
   */
  validateIsRegularFile(filePath: string): { valid: boolean; error?: string } {
    try {
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: "文件不存在" };
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return { valid: false, error: "不是普通文件（可能是目录或特殊文件）" };
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "文件类型检查失败" };
    }
  }

  /**
   * 检查文件读取权限
   */
  validateReadPermission(filePath: string): { valid: boolean; error?: string } {
    try {
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: "文件不存在" };
      }

      fs.accessSync(filePath, fs.constants.R_OK);
      return { valid: true };
    } catch {
      return { valid: false, error: "文件读取权限不足" };
    }
  }

  /**
   * 检查目录是否可写（用于文件移动操作）
   */
  validateDirectoryWritePermission(dirPath: string): { valid: boolean; error?: string } {
    try {
      if (!fs.existsSync(dirPath)) {
        return { valid: false, error: "目录不存在" };
      }

      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        return { valid: false, error: "不是目录" };
      }

      // 尝试创建临时文件来测试写权限
      const testFile = `${dirPath}/.write_test_${Date.now()}`;
      try {
        fs.writeFileSync(testFile, "test");
        fs.unlinkSync(testFile);
        return { valid: true };
      } catch {
        return { valid: false, error: "目录写入权限不足" };
      }
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "目录权限检查失败" };
    }
  }

  /**
   * 验证文件路径是否安全（增强版：防止路径遍历攻击、符号链接攻击等）
   */
  validateSafePath(filePath: string, allowedBaseDir: string): { valid: boolean; normalizedPath?: string; error?: string } {
    try {
      // 首先检查原始路径是否包含危险字符
      if (filePath.includes('..') || filePath.includes('~') ||
          filePath.includes('$') || filePath.includes('%')) {
        return { valid: false, error: "包含不安全的路径字符" };
      }

      // 检查路径长度（防止缓冲区溢出）
      if (filePath.length > 4096) {
        return { valid: false, error: "路径长度超过限制" };
      }

      // 系统路径安全检查
      const pathCheck = this.containsSystemPaths(filePath);
      if (!pathCheck.safe) {
        return { valid: false, error: pathCheck.reason };
      }

      // 规范化路径
      const normalizedPath = path.normalize(filePath);

      // 再次检查规范化后的路径
      if (normalizedPath.includes('..')) {
        return { valid: false, error: "路径包含相对路径遍历" };
      }

      // 解析绝对路径
      const resolvedBase = path.resolve(allowedBaseDir);
      const resolvedFile = path.resolve(allowedBaseDir, normalizedPath);

      // 检查解析后的路径是否在允许的基础目录内
      if (!resolvedFile.startsWith(resolvedBase)) {
        return { valid: false, error: "路径超出了允许的目录范围" };
      }

      // 如果文件存在，检查符号链接安全性
      if (fs.existsSync(resolvedFile)) {
        const symlinkCheck = this.resolveSymlinks(resolvedFile);
        if (!symlinkCheck.safe) {
          return { valid: false, error: symlinkCheck.reason };
        }

        // 确保符号链接的真实路径仍在允许范围内
        const realPath = symlinkCheck.realPath!;
        if (!realPath.startsWith(resolvedBase)) {
          return { valid: false, error: "符号链接指向了不允许的目录" };
        }
      }

      return { valid: true, normalizedPath: normalizedPath };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "路径验证失败" };
    }
  }

  /**
   * 验证文件名是否安全
   */
  validateFileName(fileName: string): { valid: boolean; reason?: string } {
    try {
      // 检查文件名长度
      if (fileName.length === 0 || fileName.length > 255) {
        return { valid: false, reason: "文件名长度无效（必须为1-255字符）" };
      }

      // 检查危险字符
      const dangerousChars = /[<>:"|?*\x00-\x1f]/;
      if (dangerousChars.test(fileName)) {
        return { valid: false, reason: "文件名包含非法字符" };
      }

      // 检查Windows保留名称
      const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
      if (windowsReserved.test(fileName)) {
        return { valid: false, reason: "文件名为系统保留名称" };
      }

      // 检查是否以点或空格开始/结束
      if (fileName.startsWith('.') || fileName.endsWith('.') ||
          fileName.startsWith(' ') || fileName.endsWith(' ')) {
        return { valid: false, reason: "文件名不能以点或空格开始/结束" };
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, reason: err instanceof Error ? err.message : "文件名验证失败" };
    }
  }

  /**
   * 综合验证文件是否适合进行处理
   */
  validateFileForProcessing(filePath: string, maxSize?: number): {
    valid: boolean;
    isText?: boolean;
    reason?: string;
  } {
    // 检查文件存在性和基本属性
    const basicValidation = this.validateIsRegularFile(filePath);
    if (!basicValidation.valid) {
      return { valid: false, reason: basicValidation.error };
    }

    // 检查权限
    const permissionValidation = this.validateReadPermission(filePath);
    if (!permissionValidation.valid) {
      return { valid: false, reason: permissionValidation.error };
    }

    // 检查大小
    const sizeLimit = maxSize || (2 * 1024 * 1024 * 1024); // 默认2GB
    const sizeValidation = this.validateFileSize(filePath, sizeLimit);
    if (!sizeValidation.valid) {
      return { valid: false, reason: sizeValidation.error };
    }

    return { valid: true };
  }
}