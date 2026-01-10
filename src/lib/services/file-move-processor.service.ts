import path from 'node:path';
import { logger } from '@/lib/logger';
import { getConfig } from '@/lib/config';
import { FileMoveService } from './file-move.service';
import { FileValidatorService } from './file-processing/file-validator.service';
import type { ProcessedFile } from '@/lib/api-client';

const config = getConfig();
const {
  directories: { root_dir: ROOT_DIR },
} = config;

// 文件移动信息接口
export interface FileMoveInfo {
  fileName: string;
  sourcePath: string;
  targetDir: string;
  method: 'similarity' | 'ai';
  score?: number;
  reasoning?: string; // AI分类原因
}

// 文件移动结果接口
export interface FileMoveResult {
  successfulMoves: number;
  failedMoves: number;
  errors: Array<{ fileName: string; error: string }>;
}

/**
 * 文件移动处理服务 - 统一处理文件移动逻辑
 */
export class FileMoveProcessorService {
  private validator: FileValidatorService;

  constructor(private fileMoveService: FileMoveService) {
    this.validator = new FileValidatorService();
  }

  /**
   * 批量移动文件 - 统一入口
   */
  async batchMoveFiles(
    taskId: string,
    processedFiles: ProcessedFile[],
    moveInfos: FileMoveInfo[],
    dryRun: boolean,
    onDirectoryUpdated?: (directoryPath: string) => void
  ): Promise<FileMoveResult> {
    logger.info({ taskId, files: moveInfos.length }, '开始批量移动文件');

    const result: FileMoveResult = {
      successfulMoves: 0,
      failedMoves: 0,
      errors: [],
    };

    for (const moveInfo of moveInfos) {
      try {
        await this.moveSingleFile(taskId, processedFiles, moveInfo, dryRun);
        result.successfulMoves++;

        // 更新目录（如果需要）
        const targetDir = path.join(ROOT_DIR, moveInfo.targetDir);
        if (onDirectoryUpdated) {
          onDirectoryUpdated(targetDir);
        }

        logger.info(
          {
            taskId,
            file: moveInfo.fileName,
            to: moveInfo.targetDir,
            method: moveInfo.method,
            score: moveInfo.score?.toFixed(2),
          },
          '文件已移动'
        );
      } catch (error) {
        result.failedMoves++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({ fileName: moveInfo.fileName, error: errorMsg });

        logger.error({ taskId, err: error, file: moveInfo.fileName }, '文件移动失败');

        // 更新状态为"失败"
        const file = processedFiles.find((f) => f.name === moveInfo.fileName);
        if (file) {
          file.status = 'failed';
          file.error = errorMsg;
          file.processStage = 'complete';
          file.progress = 100;
        }
      }
    }

    logger.info(
      {
        taskId,
        total: moveInfos.length,
        successful: result.successfulMoves,
        failed: result.failedMoves,
      },
      '批量文件移动完成'
    );

    return result;
  }

  /**
   * 移动单个文件
   */
  private async moveSingleFile(
    _taskId: string,
    processedFiles: ProcessedFile[],
    moveInfo: FileMoveInfo,
    _dryRun: boolean
  ): Promise<void> {
    const targetDir = path.join(ROOT_DIR, moveInfo.targetDir);
    const finalTargetPath = path.join(targetDir, moveInfo.fileName);

    const file = processedFiles.find((f) => f.name === moveInfo.fileName);
    if (!file) {
      throw new Error(`找不到文件记录: ${moveInfo.fileName}`);
    }

    // 验证目标目录路径是否在允许范围内（防止路径遍历）
    const targetPathValidation = this.validator.validateSafePath(finalTargetPath, ROOT_DIR);
    if (!targetPathValidation.valid) {
      throw new Error(`目标路径验证失败: ${targetPathValidation.error}`);
    }

    // 更新状态为"移动中"
    file.status = 'moving';
    file.processStage = 'move';
    file.targetPath = finalTargetPath;
    file.progress = 75;
    if (moveInfo.reasoning) {
      file.reasoning = moveInfo.reasoning;
    }

    // 执行移动（FileMoveService 内部已有源文件和目录验证）
    const moveResult = await this.fileMoveService.moveFile(moveInfo.sourcePath, finalTargetPath);
    if (!moveResult.success) {
      throw new Error(moveResult.error || '移动文件失败');
    }

    // 更新状态为"成功"
    file.status = 'success';
    file.targetPath = finalTargetPath;
    file.processStage = 'complete';
    file.progress = 100;
  }

  /**
   * 从相似度匹配结果创建移动信息
   */
  static createMoveInfosFromSimilarity(
    similarityResults: Array<{
      fileName: string;
      filePath: string;
      bestDir: string;
      bestScore: number;
    }>
  ): FileMoveInfo[] {
    return similarityResults.map((result) => ({
      fileName: result.fileName,
      sourcePath: result.filePath,
      targetDir: result.bestDir,
      method: 'similarity' as const,
      score: result.bestScore,
    }));
  }

  /**
   * 从AI分类结果创建移动信息
   */
  static createMoveInfosFromAI(
    aiResults: Array<{
      fileName: string;
      path: string;
      reasoning?: string;
    }>,
    originalFiles: Array<{
      fileName: string;
      filePath: string;
    }>
  ): FileMoveInfo[] {
    return aiResults
      .map((result) => {
        const originalFile = originalFiles.find((f) => f.fileName === result.fileName);
        return {
          fileName: result.fileName,
          sourcePath: originalFile?.filePath || '',
          targetDir: this.normalizeTargetPath(result.path, originalFile?.filePath),
          method: 'ai' as const,
          reasoning: result.reasoning,
        };
      })
      .filter((info) => info.sourcePath !== ''); // 过滤掉找不到源文件的情况
  }

  /**
   * 规范化目标路径
   */
  private static normalizeTargetPath(givenPath: string, sourcePath?: string): string {
    let targetDir = givenPath.trim() || '未分类';

    if (sourcePath) {
      const givenBase = path.basename(targetDir);
      const fileBase = path.basename(sourcePath);
      // 如果目标路径的basename与源文件名相同，则使用其父目录
      if (givenBase === fileBase) {
        targetDir = path.dirname(targetDir);
      }
    }

    return targetDir;
  }
}
