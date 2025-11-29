'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { FileIcon } from './FileIcon';
import { toast } from 'sonner';

// 日志级别映射
export const LOG_LEVELS: Record<number, { label: string; color: string; bgColor: string }> = {
  10: {
    label: 'TRACE',
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  20: {
    label: 'DEBUG',
    color: 'text-gray-600 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  30: {
    label: 'INFO',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  40: {
    label: 'WARN',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
  },
  50: {
    label: 'ERROR',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
  },
  60: {
    label: 'FATAL',
    color: 'text-red-800 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900',
  },
};

// 格式化时间
export const formatTime = (isoTime: string): string => {
  try {
    const date = new Date(isoTime);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoTime;
  }
};

interface LogRendererProps {
  log: string;
  index: number;
  expandedLogs: Set<number>;
  onToggleExpand: (index: number) => void;
  showCopyButton?: boolean;
}

export const LogRenderer: React.FC<LogRendererProps> = ({
  log,
  index,
  expandedLogs,
  onToggleExpand,
  showCopyButton = true,
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  try {
    const logObj = JSON.parse(log);
    const { time, level, msg, module, ...rest } = logObj;

    const levelInfo = LOG_LEVELS[level] || {
      label: `${level}`,
      color: 'text-gray-600 dark:text-gray-300',
      bgColor: 'bg-gray-50 dark:bg-gray-800',
    };
    const formattedTime = time ? formatTime(time) : '';
    const isExpanded = expandedLogs.has(index);
    const hasExtraData = Object.keys(rest).length > 0;

    // 提取关键信息用于特殊显示
    const {
      file,
      from,
      to,
      method,
      reasoning,
      similarity,
      score,
      similar,
      // AI日志特有字段
      totalFiles,
      classified,
      tokens,
      promptTokens,
      completionTokens,
      elapsedMs,
      avgMsPerFile,
      batchSize,
      totalBatches,
      batchIndex,
      uniqueDirs,
      newDirs,
      existingDirs,
      sample,
      successRate,
      filesSample,
      hasMore,
      model,
      progress,
      taskId,
      successfulMoves,
      failedMoves,
      targetDirs,
      dryRun,
      errorType,
      filesCount,
      ...otherData
    } = rest;

    return (
      <div
        className={`rounded-lg border ${levelInfo.bgColor} ${levelInfo.color.includes('border') ? '' : 'border-border/20'} p-3 hover:shadow-md transition-all duration-200`}
      >
        <div className="flex items-start gap-2">
          {hasExtraData && (
            <button
              onClick={() => onToggleExpand(index)}
              className="mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 transition-colors"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
                {formattedTime}
              </span>
              <Badge
                variant="outline"
                className={`${levelInfo.color} ${levelInfo.bgColor} border-current/30`}
              >
                {levelInfo.label}
              </Badge>
              {module && (
                <Badge variant="secondary" className="text-xs">
                  {module}
                </Badge>
              )}
              {method && (
                <Badge
                  variant="default"
                  className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                >
                  {method}
                </Badge>
              )}
            </div>

            <div className="mt-1 text-sm text-gray-800 dark:text-gray-200 font-medium">{msg}</div>

            {/* AI日志的特殊展示 */}
            {module === 'ai' &&
              (tokens !== undefined || totalFiles !== undefined || batchIndex !== undefined) && (
                <div className="mt-3 space-y-2">
                  {/* Token使用情况 */}
                  {tokens !== undefined && (
                    <div className="flex flex-wrap gap-2 items-center text-xs">
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      >
                        🎯 Tokens: {tokens}
                      </Badge>
                      {promptTokens !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        >
                          📝 Prompt: {promptTokens}
                        </Badge>
                      )}
                      {completionTokens !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                        >
                          ✨ Completion: {completionTokens}
                        </Badge>
                      )}
                      {model && (
                        <Badge
                          variant="outline"
                          className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                        >
                          🤖 {model}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* 批次和文件信息 */}
                  {(totalFiles !== undefined || batchIndex !== undefined) && (
                    <div className="flex flex-wrap gap-2 items-center text-xs">
                      {totalFiles !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        >
                          📦 文件: {classified || totalFiles}/{totalFiles}
                        </Badge>
                      )}
                      {batchIndex !== undefined && totalBatches !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                        >
                          🔄 批次: {batchIndex}/{totalBatches}
                        </Badge>
                      )}
                      {progress !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                        >
                          ⏳ 进度: {progress}%
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* 目录统计 */}
                  {(uniqueDirs !== undefined || targetDirs !== undefined) && (
                    <div className="flex flex-wrap gap-2 items-center text-xs">
                      {uniqueDirs !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                        >
                          📁 目录: {uniqueDirs}个
                        </Badge>
                      )}
                      {newDirs !== undefined && newDirs > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
                        >
                          ✨ 新建: {newDirs}
                        </Badge>
                      )}
                      {existingDirs !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800"
                        >
                          ♻️ 复用: {existingDirs}
                        </Badge>
                      )}
                      {targetDirs !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                        >
                          🎯 目标: {targetDirs}个目录
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* 性能和成功率 */}
                  {(elapsedMs !== undefined || successRate !== undefined) && (
                    <div className="flex flex-wrap gap-2 items-center text-xs">
                      {elapsedMs !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                        >
                          ⚡ 耗时: {elapsedMs}ms
                        </Badge>
                      )}
                      {avgMsPerFile !== undefined && avgMsPerFile > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        >
                          📊 平均: {avgMsPerFile}ms/文件
                        </Badge>
                      )}
                      {successRate !== undefined && (
                        <Badge
                          variant="outline"
                          className={
                            successRate >= 90
                              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                              : successRate >= 70
                                ? 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                                : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                          }
                        >
                          ✅ 成功率: {successRate}%
                        </Badge>
                      )}
                      {successfulMoves !== undefined && (
                        <Badge
                          variant="outline"
                          className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                        >
                          ✅ 成功: {successfulMoves}
                        </Badge>
                      )}
                      {failedMoves !== undefined && failedMoves > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                        >
                          ❌ 失败: {failedMoves}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* 文件样本 */}
                  {filesSample && Array.isArray(filesSample) && filesSample.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/50 rounded border border-blue-100 dark:border-blue-900">
                      <div className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">
                        📄 文件样本:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {filesSample.map((fileName: unknown, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs text-blue-600 dark:text-blue-400 bg-white dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800"
                          >
                            {String(fileName)}
                          </span>
                        ))}
                        {hasMore && (
                          <span className="text-xs text-blue-500 dark:text-blue-400">...</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI分类样本 */}
                  {sample && Array.isArray(sample) && sample.length > 0 && (
                    <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950/50 rounded border border-purple-100 dark:border-purple-900">
                      <div className="text-xs text-purple-700 dark:text-purple-300 font-semibold mb-1">
                        🎯 分类样本:
                      </div>
                      <div className="space-y-1">
                        {sample.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="text-xs bg-white dark:bg-purple-900/30 p-2 rounded border border-purple-200 dark:border-purple-800"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-purple-600 dark:text-purple-400 font-mono">
                                {item.file || item.fileName}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600 dark:text-green-400 font-semibold">
                                {item.dir || item.path}
                              </span>
                            </div>
                            {item.reason && (
                              <div className="mt-1 text-gray-600 dark:text-gray-400 italic">
                                {item.reason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 错误类型标识 */}
                  {errorType && (
                    <Badge
                      variant="outline"
                      className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                    >
                      ⚠️ 错误类型: {errorType}
                    </Badge>
                  )}

                  {/* 预演模式标识 */}
                  {dryRun && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    >
                      🔍 预演模式
                    </Badge>
                  )}
                </div>
              )}

            {/* 显示关键字段（非AI日志或文件移动日志） */}
            {(file || from || to || similarity !== undefined || score !== undefined || similar) && (
              <div className="mt-2 space-y-1 text-xs">
                {file && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">文件:</span>
                    <FileIcon
                      extension={typeof file === 'string' ? file.split('.').pop() : undefined}
                      size="w-3 h-3"
                      className="text-muted-foreground shrink-0"
                    />
                    <span className="text-blue-600 dark:text-blue-400 font-mono">{file}</span>
                  </div>
                )}
                {from && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">源:</span>
                    <span
                      className="text-gray-700 dark:text-gray-300 font-mono truncate"
                      title={from as string}
                    >
                      {from as string}
                    </span>
                  </div>
                )}
                {to && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">目标:</span>
                    <span
                      className="text-green-600 dark:text-green-400 font-mono truncate"
                      title={to as string}
                    >
                      {to as string}
                    </span>
                  </div>
                )}
                {(similarity !== undefined || score !== undefined) && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">相似度:</span>
                    <span className="text-orange-600 dark:text-orange-400 font-semibold">
                      {similarity || score ? Number(similarity || score).toFixed(4) : 'N/A'}
                    </span>
                    {similar && (
                      <span className="text-gray-500 dark:text-gray-400">
                        ← {similar as string}
                      </span>
                    )}
                  </div>
                )}
                {reasoning && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">理由:</span>
                    <span className="text-gray-700 dark:text-gray-300 italic">
                      {reasoning as string}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 展开显示完整数据 */}
            {isExpanded && Object.keys(otherData).length > 0 && (
              <div className="mt-2 p-2 bg-gray-800 dark:bg-gray-950 text-gray-100 dark:text-gray-300 rounded text-xs font-mono overflow-x-auto">
                <pre>{JSON.stringify(otherData, null, 2)}</pre>
              </div>
            )}
          </div>

          {showCopyButton && (
            <button
              onClick={() => copyToClipboard(log)}
              className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 transition-colors"
              title="复制日志"
            >
              <Copy size={14} />
            </button>
          )}
        </div>
      </div>
    );
  } catch {
    // 无法解析的日志，使用原始显示
    return (
      <div className="rounded-lg border border-border/20 bg-gray-50 dark:bg-gray-900 p-2 text-sm text-gray-700 dark:text-gray-300 font-mono break-all whitespace-pre-wrap">
        {log}
      </div>
    );
  }
};
