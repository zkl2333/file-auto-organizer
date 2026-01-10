import path from 'node:path';
import fs from 'node:fs';
import { logger } from '@/lib/logger';

// 文本文件处理配置
export const TEXT_FILE_CONFIG = {
  MAX_PREVIEW_LINES: 3, // 减少行数，避免过多token
  MAX_PREVIEW_CHARS: 300, // 减少字符数，聚焦核心内容
  MAX_FILE_SIZE: 1024 * 1024, // 1MB
  ENCODING_FALLBACK: 'latin1' as BufferEncoding,
  CHUNK_SIZE: 8192, // 默认块大小
  MAX_CHUNK_SIZE: 64 * 1024, // 最大块大小
  READ_TIMEOUT: 5000, // 读取超时（毫秒）
} as const;

// 文件操作性能监控
class FileOperationMetrics {
  private static operations = new Map<
    string,
    { count: number; totalTime: number; errors: number }
  >();

  static recordOperation(operation: string, duration: number, success: boolean) {
    const current = this.operations.get(operation) || { count: 0, totalTime: 0, errors: 0 };
    current.count++;
    current.totalTime += duration;
    if (!success) current.errors++;

    this.operations.set(operation, current);

    // 记录慢操作
    if (duration > 1000) {
      logger.warn({ module: 'file-reader', operation, duration, success }, '检测到慢文件操作');
    }
  }

  static getMetrics() {
    const result: Record<string, { avgDuration: number; count: number; errorRate: number }> = {};

    for (const [op, metrics] of this.operations) {
      result[op] = {
        avgDuration: metrics.totalTime / metrics.count,
        count: metrics.count,
        errorRate: metrics.errors / metrics.count,
      };
    }

    return result;
  }
}

// 常见文本文件扩展名
const TEXT_FILE_EXTENSIONS = new Set([
  '.txt',
  '.log',
  '.md',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.ts',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.php',
  '.rb',
  '.go',
  '.rs',
  '.kt',
  '.swift',
  '.sql',
  '.sh',
  '.bat',
  '.cmd',
  '.ps1',
  '.yaml',
  '.yml',
  '.ini',
  '.conf',
  '.config',
  '.properties',
  '.env',
  '.gitignore',
  '.dockerfile',
  '.csv',
  '.tsv',
  '.rtf',
  '.tex',
  '.latex',
]);

// 二进制文件特征字节
const BINARY_SIGNATURES = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46], // GIF
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x50, 0x4b, 0x03, 0x04], // ZIP
  [0x52, 0x61, 0x72, 0x21], // RAR
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0x4d, 0x5a], // PE/EXE
];

/**
 * 文件读取服务 - 专注于文件读取和内容处理
 * 增强版：性能监控、错误处理、资源管理
 */
export class FileReaderService {
  constructor() {
    // 定期记录性能指标
    setInterval(() => {
      const metrics = FileOperationMetrics.getMetrics();
      if (Object.keys(metrics).length > 0) {
        logger.debug({ module: 'file-reader', metrics }, '文件操作性能指标');
      }
    }, 60000); // 每分钟记录一次
  }

  /**
   * 检测文件是否为文本文件（增强版：性能监控）
   */
  isTextFile(filePath: string): boolean {
    const startTime = Date.now();
    const fileName = path.basename(filePath);

    try {
      const ext = path.extname(filePath).toLowerCase();

      // 首先检查扩展名
      if (TEXT_FILE_EXTENSIONS.has(ext)) {
        FileOperationMetrics.recordOperation('isTextFile_extension', Date.now() - startTime, true);
        return true;
      }

      // 流式读取前1024字节判断文件类型
      const sample = this.readFileChunk(filePath, 0, 1024);

      // 检查是否匹配已知的二进制文件签名
      for (const signature of BINARY_SIGNATURES) {
        if (sample.length >= signature.length) {
          let matches = true;
          for (let i = 0; i < signature.length; i++) {
            if (sample[i] !== signature[i]) {
              matches = false;
              break;
            }
          }
          if (matches) {
            FileOperationMetrics.recordOperation(
              'isTextFile_binary_signature',
              Date.now() - startTime,
              true
            );
            return false;
          }
        }
      }

      // 检查是否包含过多的null字节或不可打印字符
      let nullBytes = 0;
      let nonPrintable = 0;

      for (let i = 0; i < sample.length; i++) {
        const byte = sample[i];
        if (byte === 0) {
          nullBytes++;
        } else if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) {
          nonPrintable++;
        }
      }

      // 如果null字节占比超过1%或不可打印字符占比超过30%，则认为是二进制文件
      const nullRatio = nullBytes / sample.length;
      const nonPrintableRatio = nonPrintable / sample.length;
      const isText = nullRatio < 0.01 && nonPrintableRatio < 0.3;

      FileOperationMetrics.recordOperation(
        'isTextFile_content_analysis',
        Date.now() - startTime,
        true
      );
      return isText;
    } catch (err) {
      FileOperationMetrics.recordOperation('isTextFile_error', Date.now() - startTime, false);
      logger.error({ module: 'file-reader', file: fileName, err }, '文件类型检测失败');
      return false;
    }
  }

  /**
   * 统一的文件块读取方法（增强版：资源管理、错误处理）
   */
  private readFileChunk(filePath: string, offset: number, size: number): Buffer {
    const startTime = Date.now();
    let fd: number | null = null;

    try {
      // 参数验证
      if (size <= 0 || size > TEXT_FILE_CONFIG.MAX_CHUNK_SIZE) {
        throw new Error(`无效的读取大小: ${size}`);
      }

      if (offset < 0) {
        throw new Error(`无效的偏移量: ${offset}`);
      }

      fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(size);
      const bytesRead = fs.readSync(fd, buffer, 0, size, offset);

      FileOperationMetrics.recordOperation('readFileChunk', Date.now() - startTime, true);
      return buffer.subarray(0, bytesRead);
    } catch (err) {
      FileOperationMetrics.recordOperation('readFileChunk_error', Date.now() - startTime, false);
      logger.error(
        {
          module: 'file-reader',
          file: path.basename(filePath),
          offset,
          size,
          err: err instanceof Error ? err.message : String(err),
        },
        '文件块读取失败'
      );
      throw err;
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch (closeErr) {
          logger.warn({ module: 'file-reader', file: path.basename(filePath) }, '文件句柄关闭失败');
        }
      }
    }
  }

  /**
   * 获取文件操作性能指标
   */
  public getPerformanceMetrics() {
    return FileOperationMetrics.getMetrics();
  }

  /**
   * 流式读取文本文件的前几行内容
   */
  readTextFileLines(
    filePath: string,
    maxLines: number = TEXT_FILE_CONFIG.MAX_PREVIEW_LINES,
    maxChars: number = TEXT_FILE_CONFIG.MAX_PREVIEW_CHARS
  ): string[] {
    const result: string[] = [];
    let totalChars = 0;
    let lineCount = 0;
    let leftover = '';
    let position = 0;
    const chunkSize = 8192;

    try {
      while (lineCount < maxLines && totalChars < maxChars) {
        const chunk = this.readFileChunk(filePath, position, chunkSize);
        if (chunk.length === 0) break; // 文件结束

        position += chunk.length;
        const text = leftover + chunk.toString('utf8');
        const lines = text.split(/\r?\n/);

        // 保存最后一行（可能不完整）
        leftover = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          let finalLine = trimmedLine;
          if (totalChars + trimmedLine.length > maxChars) {
            const remainingChars = maxChars - totalChars;
            if (remainingChars > 10) {
              finalLine = trimmedLine.substring(0, remainingChars) + '...';
            } else {
              break;
            }
          }

          result.push(finalLine);
          totalChars += finalLine.length;
          lineCount++;

          if (lineCount >= maxLines || totalChars >= maxChars) break;
        }
      }

      // 处理最后剩余的内容
      if (leftover.trim() && lineCount < maxLines && totalChars < maxChars) {
        const trimmedLine = leftover.trim();
        let finalLine = trimmedLine;
        if (totalChars + trimmedLine.length > maxChars) {
          const remainingChars = maxChars - totalChars;
          if (remainingChars > 10) {
            finalLine = trimmedLine.substring(0, remainingChars) + '...';
          }
        }
        if (finalLine) {
          result.push(finalLine);
        }
      }

      return result;
    } catch (err) {
      // 尝试使用其他编码
      try {
        const chunk = this.readFileChunk(filePath, 0, Math.min(maxChars * 2, 4096));
        const content = chunk.toString(TEXT_FILE_CONFIG.ENCODING_FALLBACK);
        const lines = content.split(/\r?\n/).slice(0, maxLines);
        return lines
          .filter((line) => line.trim())
          .map((line) =>
            line.length > maxChars / 5 ? line.substring(0, maxChars / 5) + '...' : line
          );
      } catch (fallbackErr) {
        logger.error(
          {
            module: 'file-reader',
            file: path.basename(filePath),
            error: err,
            fallbackError: fallbackErr,
          },
          '读取文本文件内容失败'
        );
        return [];
      }
    }
  }

  /**
   * 公共方法：检查文件是否为文本文件
   */
  public checkIsTextFile(filePath: string): boolean {
    return this.isTextFile(filePath);
  }

  /**
   * 公共方法：读取文本文件的前几行
   */
  getTextFilePreview(
    filePath: string,
    maxLines: number = TEXT_FILE_CONFIG.MAX_PREVIEW_LINES,
    maxChars: number = TEXT_FILE_CONFIG.MAX_PREVIEW_CHARS
  ): string[] {
    if (!this.isTextFile(filePath)) {
      throw new Error('指定文件不是文本文件');
    }
    return this.readTextFileLines(filePath, maxLines, maxChars);
  }

  /**
   * 公共方法：流式读取文本文件的完整内容
   */
  getTextFileContent(filePath: string, maxSize: number = TEXT_FILE_CONFIG.MAX_FILE_SIZE): string {
    if (!this.isTextFile(filePath)) {
      throw new Error('指定文件不是文本文件');
    }

    try {
      const stats = fs.statSync(filePath);
      if (stats.size > maxSize) {
        throw new Error(`文件过大，最大支持 ${(maxSize / 1024).toFixed(0)}KB`);
      }

      // 统一使用流式读取
      const chunk = this.readFileChunk(filePath, 0, stats.size);
      return chunk.toString('utf8');
    } catch (err) {
      if (err instanceof Error && err.message.includes('文件过大')) {
        throw err;
      }

      // 尝试其他编码
      try {
        const stats = fs.statSync(filePath);
        const chunk = this.readFileChunk(filePath, 0, Math.min(stats.size, maxSize));
        return chunk.toString(TEXT_FILE_CONFIG.ENCODING_FALLBACK);
      } catch (fallbackErr) {
        throw new Error(`读取文件失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * 公共方法：流式读取文件内容（支持回调处理每个块）
   */
  readFileStream(
    filePath: string,
    chunkProcessor: (chunk: string, isLast: boolean) => boolean, // 返回false停止读取
    options: {
      encoding?: BufferEncoding;
      chunkSize?: number;
      maxSize?: number;
    } = {}
  ): { totalBytesRead: number; stopped: boolean } {
    if (!this.isTextFile(filePath)) {
      throw new Error('指定文件不是文本文件');
    }

    const { encoding = 'utf8', chunkSize = 8192, maxSize = 100 * 1024 * 1024 } = options;

    const stats = fs.statSync(filePath);
    const fileSize = Math.min(stats.size, maxSize);

    let totalBytesRead = 0;
    let stopped = false;
    let leftover = '';

    try {
      while (totalBytesRead < fileSize && !stopped) {
        const remainingBytes = fileSize - totalBytesRead;
        const currentChunkSize = Math.min(chunkSize, remainingBytes);

        const buffer = this.readFileChunk(filePath, totalBytesRead, currentChunkSize);
        if (buffer.length === 0) break;

        totalBytesRead += buffer.length;
        const chunk = leftover + buffer.toString(encoding);

        const isLast = totalBytesRead >= fileSize;

        if (isLast) {
          if (!chunkProcessor(chunk, true)) {
            stopped = true;
          }
        } else {
          const lines = chunk.split(/\r?\n/);
          leftover = lines.pop() || '';
          const processChunk = lines.join('\n');

          if (processChunk && !chunkProcessor(processChunk, false)) {
            stopped = true;
          }
        }
      }
    } catch (err) {
      throw new Error(`流式读取文件失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { totalBytesRead, stopped };
  }

  /**
   * 公共方法：获取文件指定部分内容
   */
  getFileSegment(
    filePath: string,
    startByte: number = 0,
    maxBytes: number = 1024 * 1024,
    encoding: BufferEncoding = 'utf8'
  ): string {
    if (!this.isTextFile(filePath)) {
      throw new Error('指定文件不是文本文件');
    }

    try {
      const stats = fs.statSync(filePath);
      const actualStartByte = Math.min(startByte, stats.size);
      const actualMaxBytes = Math.min(maxBytes, stats.size - actualStartByte);

      if (actualMaxBytes <= 0) {
        return '';
      }

      const chunk = this.readFileChunk(filePath, actualStartByte, actualMaxBytes);
      return chunk.toString(encoding);
    } catch (err) {
      // 尝试其他编码
      try {
        const chunk = this.readFileChunk(filePath, startByte, Math.min(maxBytes, 4096));
        return chunk.toString(TEXT_FILE_CONFIG.ENCODING_FALLBACK);
      } catch (fallbackErr) {
        throw new Error(`读取文件段失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
