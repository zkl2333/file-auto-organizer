'use client';

import React, { useState } from 'react';
import { useTaskDetail, useTaskLogs, useTaskFilesRealtime } from '@/hooks/useApi';
import { type ProcessedFile, type FileProcessStatus } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Search, File, Database } from 'lucide-react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Clock,
  FileText,
  Zap,
  RefreshCw,
  Activity,
  Brain,
  Target,
  TrendingUp,
  BarChart3,
  FileStack,
  FolderTree,
} from 'lucide-react';
import { FileIcon } from './FileIcon';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { LogRenderer } from './LogRenderer';

const formatDuration = (ms: number | undefined): string => {
  if (ms == null || isNaN(ms)) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
};

const formatTime = (isoTime: string | undefined): string => {
  if (!isoTime) return '-';
  try {
    const date = new Date(isoTime);
    if (isNaN(date.getTime())) return isoTime;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
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

const LOG_TYPES = [
  { value: 'main', label: '主服务', icon: '📋' },
  { value: 'ai', label: 'AI分类', icon: '🤖' },
  { value: 'file-move', label: '文件移动', icon: '📁' },
  { value: 'file-scan', label: '扫描', icon: '🔍' },
  { value: 'file-info', label: '文件信息', icon: '📄' },
];

// 图表颜色配置 - 使用现代渐变色系
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#6366f1',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

export const TaskDetailView: React.FC<{
  taskId: string;
  onBack?: () => void;
}> = ({ taskId, onBack }) => {
  const [currentLogType, setCurrentLogType] = useState('main');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const { data: task, error, isLoading } = useTaskDetail(taskId);
  const { data: logsData, isLoading: logsLoading } = useTaskLogs(taskId, currentLogType, 500);

  // 使用实时轮询获取文件列表
  // 如果任务状态是 running，则启用轮询；否则禁用
  const taskIsRunning = task?.status === 'running';
  const { data: taskFiles, isLoading: filesLoading } = useTaskFilesRealtime(
    taskId,
    2000, // 每2秒轮询一次
    taskIsRunning // 只在任务运行时轮询
  );

  const logs = logsData?.logs || [];
  const processedFiles: ProcessedFile[] = taskFiles?.files || [];

  // 状态映射函数
  const getFileStatusConfig = (status: FileProcessStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: '待处理',
          variant: 'secondary' as const,
          color: 'text-gray-600 dark:text-gray-400',
        };
      case 'similarity_matching':
        return {
          label: '匹配中',
          variant: 'outline' as const,
          color: 'text-blue-600 dark:text-blue-400',
        };
      case 'similarity_matched':
        return {
          label: '已匹配',
          variant: 'outline' as const,
          color: 'text-green-600 dark:text-green-400',
        };
      case 'ai_classifying':
        return {
          label: 'AI分类中',
          variant: 'outline' as const,
          color: 'text-purple-600 dark:text-purple-400',
        };
      case 'ai_classified':
        return {
          label: 'AI已分类',
          variant: 'outline' as const,
          color: 'text-purple-600 dark:text-purple-400',
        };
      case 'moving':
        return {
          label: '移动中',
          variant: 'outline' as const,
          color: 'text-orange-600 dark:text-orange-400',
        };
      case 'success':
        return {
          label: '成功',
          variant: 'default' as const,
          color: 'text-green-600 dark:text-green-400',
        };
      case 'failed':
        return {
          label: '失败',
          variant: 'destructive' as const,
          color: 'text-red-600 dark:text-red-400',
        };
      case 'skipped':
        return {
          label: '跳过',
          variant: 'secondary' as const,
          color: 'text-gray-600 dark:text-gray-400',
        };
      default:
        return {
          label: '未知',
          variant: 'secondary' as const,
          color: 'text-gray-600 dark:text-gray-400',
        };
    }
  };

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  if (isLoading || filesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-12 h-12 animate-spin text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">加载任务详情</h2>
            <p className="text-sm text-muted-foreground">
              {isLoading && filesLoading
                ? '正在获取任务信息和文件列表，请稍候...'
                : isLoading
                  ? '正在获取任务信息，请稍候...'
                  : '正在获取文件列表，请稍候...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    const errorMessage = error instanceof Error ? error.message : '任务不存在';
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  const StatusIcon =
    task.status === 'success'
      ? CheckCircle
      : task.status === 'failed'
        ? XCircle
        : task.status === 'running'
          ? RefreshCw
          : AlertCircle;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'success':
        return {
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-200 dark:border-green-800',
          label: '成功',
          gradient: 'from-green-500 to-emerald-600',
        };
      case 'failed':
        return {
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-200 dark:border-red-800',
          label: '失败',
          gradient: 'from-red-500 to-rose-600',
        };
      case 'running':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          label: '运行中',
          gradient: 'from-blue-500 to-cyan-600',
        };
      case 'partial':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          label: '部分成功',
          gradient: 'from-yellow-500 to-amber-600',
        };
      default:
        return {
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
          label: '未知',
          gradient: 'from-gray-500 to-slate-600',
        };
    }
  };

  const statusConfig = getStatusConfig(task.status);

  const fileTypeData = task.fileTypes
    ? Object.entries(task.fileTypes)
        .map(([type, count]) => ({
          type,
          count,
        }))
        .sort((a, b) => b.count - a.count) // 按数量降序排列
    : [];

  // 使用真实文件列表数据
  const allFiles = processedFiles.map((file, index) => ({
    ...file,
    id: `${file.name}_${index}`, // 为前端需要生成唯一ID
  }));

  // 从真实文件数据中提取文件类型
  const realFileTypeData = allFiles.reduce(
    (acc, file) => {
      const type = file.type || '无扩展名';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const fileTypes = Object.entries(realFileTypeData)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // 过滤文件
  const filteredFiles = allFiles.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedFileType === 'all' || file.type === selectedFileType;
    return matchesSearch && matchesType;
  });

  // 计算总数用于统计
  const totalFiles = allFiles.length;
  const successFiles = allFiles.filter((f) => f.status === 'success').length;
  const failedFiles = allFiles.filter((f) => f.status === 'failed').length;
  const skippedFiles = allFiles.filter((f) => f.status === 'skipped').length;

  // 分离失败的文件
  const failedFilesList = allFiles.filter((f) => f.status === 'failed');

  return (
    <div className="space-y-6 min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="gap-2 hover:bg-muted/50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">返回</span>
                </Button>
              )}
              <div className="space-y-1">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                  任务详情
                </h1>
                <p className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                  <Target className="w-3 h-3" />
                  {task.taskId}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`gap-2 px-3 py-1 ${statusConfig.borderColor} ${statusConfig.bgColor}`}
            >
              <StatusIcon
                className={`w-4 h-4 ${statusConfig.color} ${
                  task.status === 'running' ? 'animate-spin' : ''
                }`}
              />
              <span className={statusConfig.color}>{statusConfig.label}</span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 space-y-6">
        {/* 任务状态概览卡片 */}
        <Card
          className={`border-0 bg-gradient-to-br ${statusConfig.bgColor} ${statusConfig.borderColor} shadow-lg`}
        >
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  开始时间
                </div>
                <div className="font-medium">{formatTime(task.startTime)}</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="w-4 h-4" />
                  结束时间
                </div>
                <div className="font-medium">{formatTime(task.endTime)}</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  执行时长
                </div>
                <div className="font-medium">{formatDuration(task.duration)}</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="w-4 h-4" />
                  运行模式
                </div>
                <div>
                  {task.dryRun ? (
                    <Badge
                      variant="outline"
                      className="text-xs bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300"
                    >
                      模拟运行
                    </Badge>
                  ) : (
                    <Badge className="text-xs bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300">
                      正式运行
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {task.errorMessage && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription className="text-sm">{task.errorMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 统计信息卡片 */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-blue-500/20 dark:bg-blue-500/10 group-hover:scale-110 transition-transform duration-300">
                  <FileStack className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  文件
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">处理文件总数</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {task.filesProcessed ?? 0}
                  </h3>
                  <span className="text-xs text-blue-600 dark:text-blue-400">个</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-green-500/20 dark:bg-green-500/10 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                >
                  相似度
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">相似度匹配</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-green-900 dark:text-green-100">
                    {task.similarityMatched ?? 0}
                  </h3>
                  <span className="text-xs text-green-600 dark:text-green-400">个</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-purple-500/20 dark:bg-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-purple-100/50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                >
                  AI
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">AI分类</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                    {task.aiClassified ?? 0}
                  </h3>
                  <span className="text-xs text-purple-600 dark:text-purple-400">个</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-orange-500/20 dark:bg-orange-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-orange-100/50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                >
                  Token
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  Token消耗
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                    {(task.tokensUsed ?? 0).toLocaleString()}
                  </h3>
                  <span className="text-xs text-orange-600 dark:text-orange-400">个</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 失败文件突出展示 - 仅在有失败文件时显示 */}
        {failedFilesList.length > 0 && (
          <Card className="border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-red-100/30 dark:from-red-950/20 dark:to-red-900/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-500 text-white shadow-lg">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-red-900 dark:text-red-100">
                      失败文件清单
                    </CardTitle>
                    <CardDescription className="text-sm mt-1 text-red-700 dark:text-red-300">
                      以下 {failedFilesList.length} 个文件处理失败，需要手动处理
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3 h-3" />
                  {failedFilesList.length} 个失败
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {failedFilesList.map((file, idx) => (
                  <div
                    key={file.id || idx}
                    className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-lg p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 shrink-0">
                        <FileIcon
                          extension={file.type}
                          className="text-red-600 dark:text-red-400"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {file.name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {file.type} · {file.size}
                            </p>
                          </div>
                          {file.method && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {file.method === 'ai' ? '🤖 AI' : '🎯 相似度'}
                            </Badge>
                          )}
                        </div>

                        {file.error && (
                          <Alert variant="destructive" className="py-2 px-3">
                            <AlertDescription className="text-xs flex items-start gap-2">
                              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span className="flex-1">{file.error}</span>
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="space-y-1">
                            <span className="text-gray-500 dark:text-gray-400 font-semibold">
                              原路径:
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-gray-700 dark:text-gray-300 font-mono truncate cursor-help">
                                  {file.originalPath}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-md break-all">
                                <p className="text-xs">{file.originalPath}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {file.targetPath && (
                            <div className="space-y-1">
                              <span className="text-gray-500 dark:text-gray-400 font-semibold">
                                目标路径:
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-gray-700 dark:text-gray-300 font-mono truncate cursor-help">
                                    {file.targetPath}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-md break-all">
                                  <p className="text-xs">{file.targetPath}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 文件类型分布 */}
        {fileTypeData.length > 0 && (
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold">文件类型分布</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      本次任务处理 {totalFiles} 个文件（成功 {successFiles}，失败 {failedFiles}
                      ，跳过 {skippedFiles}）的类型统计和文件列表
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="hidden sm:flex">
                    {fileTypeData.length} 种类型
                  </Badge>
                  <Badge variant="outline" className="hidden sm:flex">
                    {totalFiles} 个文件
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 类型统计 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  类型统计
                </h3>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {fileTypes.map(({ type, count }, index) => {
                    const percentage = ((count / totalFiles) * 100).toFixed(1);
                    const colorIndex = index % CHART_COLORS.length;

                    return (
                      <div
                        key={type}
                        className="group/item relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-muted/20 p-4 hover:shadow-md transition-all duration-300 hover:scale-105"
                      >
                        <div
                          className={`absolute inset-0 opacity-5 group-hover/item:opacity-10 transition-opacity`}
                          style={{ backgroundColor: CHART_COLORS[colorIndex] }}
                        />
                        <div className="relative space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileIcon
                                extension={type}
                                size="w-4 h-4"
                                className="text-muted-foreground shrink-0"
                              />
                              <span
                                className="text-sm font-medium text-foreground/80 truncate"
                                title={type}
                              >
                                {type}
                              </span>
                            </div>
                            <div
                              className="px-2 py-1 rounded-lg text-xs font-semibold shadow-sm"
                              style={{
                                backgroundColor: CHART_COLORS[colorIndex],
                              }}
                            >
                              {count}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">占比</span>
                              <span className="font-medium">{percentage}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: CHART_COLORS[colorIndex],
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* 文件列表 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  文件列表
                </h3>

                {/* 搜索和过滤 */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      type="text"
                      placeholder="搜索文件名..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <select
                    value={selectedFileType}
                    onChange={(e) => setSelectedFileType(e.target.value)}
                    className="px-4 py-2 rounded-lg border bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">所有类型</option>
                    {fileTypes.map(({ type }) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 文件表格 */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="text-left px-4 py-3 text-sm font-medium">文件名</th>
                          <th className="text-left px-4 py-3 text-sm font-medium hidden md:table-cell">
                            类型
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium hidden lg:table-cell">
                            大小
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium hidden lg:table-cell">
                            原路径
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium hidden lg:table-cell">
                            目标路径
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium hidden lg:table-cell">
                            处理方式
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium hidden xl:table-cell">
                            AI分类原因
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium hidden xl:table-cell">
                            状态
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFiles.length > 0 ? (
                          filteredFiles.map((file) => (
                            <tr
                              key={file.id}
                              className="border-b hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <FileIcon
                                    extension={file.type}
                                    className="text-muted-foreground shrink-0"
                                  />
                                  <span className="font-medium text-sm truncate max-w-[200px]">
                                    {file.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <Badge variant="outline" className="text-xs">
                                  {file.type}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <span className="text-sm text-muted-foreground">{file.size}</span>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm text-muted-foreground truncate max-w-[200px] block cursor-help">
                                      {file.originalPath}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-md break-all">
                                    <p className="text-xs">{file.originalPath}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                {file.targetPath ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-sm text-muted-foreground truncate max-w-[200px] block cursor-help">
                                        {file.targetPath}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-md break-all">
                                      <p className="text-xs">{file.targetPath}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-sm text-muted-foreground/50 italic">
                                    未设置
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <div className="flex items-center gap-2">
                                  {file.method === 'similarity' && (
                                    <Target className="w-3 h-3 text-blue-500" />
                                  )}
                                  {file.method === 'ai' && (
                                    <Brain className="w-3 h-3 text-purple-500" />
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {file.method === 'similarity'
                                      ? '相似度'
                                      : file.method === 'ai'
                                        ? 'AI'
                                        : '手动'}
                                  </Badge>
                                  {file.score !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      ({(file.score * 100).toFixed(1)}%)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden xl:table-cell">
                                {file.method === 'ai' && file.reasoning ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-xs text-muted-foreground truncate max-w-[200px] block cursor-help">
                                        {file.reasoning}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-md break-all">
                                      <p className="text-xs">{file.reasoning}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-xs text-muted-foreground/50 italic">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden xl:table-cell">
                                {(() => {
                                  const statusCfg = getFileStatusConfig(file.status);
                                  return (
                                    <Badge variant={statusCfg.variant} className="text-xs">
                                      {statusCfg.label}
                                    </Badge>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                              <File className="w-12 h-12 mx-auto mb-4 opacity-20" />
                              <p className="text-sm font-medium">暂无文件</p>
                              <p className="text-xs mt-1">
                                {searchTerm || selectedFileType !== 'all'
                                  ? '没有找到匹配的文件'
                                  : '该任务没有处理任何文件'}
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 分页信息 */}
                {filteredFiles.length > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>显示 {filteredFiles.length} 个文件</span>
                    <span>共 {allFiles.length} 个文件</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 任务日志 */}
        <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-lg">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">任务日志</CardTitle>
                <CardDescription className="text-sm mt-1">
                  查看本次任务的详细执行日志
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={currentLogType} onValueChange={setCurrentLogType} className="space-y-4">
              <TabsList className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground shadow-inner">
                {LOG_TYPES.map((type) => (
                  <TabsTrigger
                    key={type.value}
                    value={type.value}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <span className="hidden sm:inline mr-2">{type.icon}</span>
                    {type.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {LOG_TYPES.map((type) => (
                <TabsContent key={type.value} value={type.value} className="space-y-4">
                  {logsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                      <p className="text-sm font-medium">加载日志中...</p>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Database className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-sm font-medium">暂无日志</p>
                      <p className="text-xs mt-1">该服务模块没有产生任何日志</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
                        <span>共 {logs.length} 条日志</span>
                        <span className="text-xs bg-muted/50 px-2 py-1 rounded">最新在前</span>
                      </div>
                      <div className="max-h-[600px] overflow-y-auto space-y-2 rounded-lg border bg-muted/20 p-4">
                        {logs.map((log, index) => (
                          <LogRenderer
                            key={index}
                            log={log}
                            index={index}
                            expandedLogs={expandedLogs}
                            onToggleExpand={toggleExpand}
                            showCopyButton={false}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskDetailView;
