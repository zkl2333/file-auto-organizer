import path from 'node:path';
import levenshtein from 'fast-levenshtein';

/**
 * 相似度计算工具函数
 */
export class SimilarityUtils {
  /**
   * 计算两个字符串的相似度
   */
  static computeSimilarity(a: string, b: string): number {
    const dist = levenshtein.get(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length) || 1;
    return 1 - dist / maxLen;
  }

  /**
   * 找到最相似的文件
   */
  static findMostSimilarFile(
    fileName: string,
    knownFileRelPaths: string[]
  ): { bestRelPath: string | null; bestDir: string | null; bestScore: number } {
    let bestRelPath: string | null = null;
    let bestDir: string | null = null;
    let bestScore = -Infinity;

    for (const rel of knownFileRelPaths) {
      const base = path.basename(rel);
      const score = this.computeSimilarity(fileName, base);
      if (score > bestScore) {
        bestScore = score;
        bestRelPath = rel;
        bestDir = path.dirname(rel);
      }
    }

    return { bestRelPath, bestDir, bestScore };
  }

  /**
   * 批量计算相似度
   */
  static batchComputeSimilarity(
    fileName: string,
    knownFileRelPaths: string[]
  ): Array<{ relPath: string; score: number; dir: string }> {
    return knownFileRelPaths
      .map((relPath) => ({
        relPath,
        score: this.computeSimilarity(fileName, path.basename(relPath)),
        dir: path.dirname(relPath),
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 根据阈值过滤相似文件
   */
  static filterByThreshold(
    results: Array<{ relPath: string; score: number; dir: string }>,
    threshold: number
  ) {
    return results.filter((result) => result.score >= threshold);
  }
}
