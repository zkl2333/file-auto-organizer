import path from "node:path";
import { mainLogger, fileMoveLogger } from "../logger.js";
import { config } from "../config.js";
import { FileMoveService } from "./file-move.service.js";
import { FileStatusService, ProcessedFile } from "./file-status.service.js";

const { ROOT_DIR } = config;

// 文件移动信息接口
export interface FileMoveInfo {
  fileName: string;
  sourcePath: string;
  targetDir: string;
  method: 'similarity' | 'ai';
  score?: number;
  reasoning?: string;  // AI分类原因
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
  constructor(
    private fileMoveService: FileMoveService,
    private fileStatusService: FileStatusService
  ) {}

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
    mainLogger.info({ files: moveInfos.length }, "开始批量移动文件");

    const result: FileMoveResult = {
      successfulMoves: 0,
      failedMoves: 0,
      errors: []
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

        fileMoveLogger.info(
          {
            file: moveInfo.fileName,
            to: moveInfo.targetDir,
            method: moveInfo.method,
            score: moveInfo.score?.toFixed(2)
          },
          "文件已移动"
        );
      } catch (error) {
        result.failedMoves++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({ fileName: moveInfo.fileName, error: errorMsg });

        mainLogger.error({ err: error, file: moveInfo.fileName }, "文件移动失败");

        // 更新状态为"失败"
        await this.fileStatusService.updateAndSaveFileStatus(taskId, processedFiles, moveInfo.fileName, {
          status: 'failed',
          error: errorMsg,
          processStage: 'complete',
          progress: 100,
        });
      }
    }

    mainLogger.info(
      {
        total: moveInfos.length,
        successful: result.successfulMoves,
        failed: result.failedMoves,
      },
      "批量文件移动完成"
    );

    return result;
  }

  /**
   * 移动单个文件
   */
  private async moveSingleFile(
    taskId: string,
    processedFiles: ProcessedFile[],
    moveInfo: FileMoveInfo,
    dryRun: boolean
  ): Promise<void> {
    const targetDir = path.join(ROOT_DIR, moveInfo.targetDir);
    const finalTargetPath = path.join(targetDir, moveInfo.fileName);

    // 更新状态为"移动中"
    await this.fileStatusService.updateAndSaveFileStatus(taskId, processedFiles, moveInfo.fileName, {
      status: 'moving',
      processStage: 'move',
      targetPath: finalTargetPath,
      progress: 75,
      reasoning: moveInfo.reasoning,
    });

    // 执行移动
    await this.fileMoveService.moveFile(moveInfo.sourcePath, targetDir, dryRun);

    // 更新状态为"成功"
    await this.fileStatusService.updateAndSaveFileStatus(taskId, processedFiles, moveInfo.fileName, {
      status: 'success',
      targetPath: finalTargetPath,
      processStage: 'complete',
      progress: 100,
      reasoning: moveInfo.reasoning,
    });
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
    return similarityResults.map(result => ({
      fileName: result.fileName,
      sourcePath: result.filePath,
      targetDir: result.bestDir,
      method: 'similarity' as const,
      score: result.bestScore
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
    return aiResults.map(result => {
      const originalFile = originalFiles.find(f => f.fileName === result.fileName);
      return {
        fileName: result.fileName,
        sourcePath: originalFile?.filePath || '',
        targetDir: this.normalizeTargetPath(result.path, originalFile?.filePath),
        method: 'ai' as const,
        reasoning: result.reasoning
      };
    }).filter(info => info.sourcePath !== ''); // 过滤掉找不到源文件的情况
  }

  /**
   * 规范化目标路径
   */
  private static normalizeTargetPath(
    givenPath: string,
    sourcePath?: string
  ): string {
    let targetDir = givenPath.trim() || "未分类";

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