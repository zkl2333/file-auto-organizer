'use client';

import { useStatus, useStats } from '@/hooks/useApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Clock,
  CheckCircle2,
  Brain,
  Sparkles,
  Zap,
  AlertTriangle,
  XCircle,
  FlaskConical,
  Database,
  FileInput,
  FolderOpen,
} from 'lucide-react';

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  const { data: status } = useStatus();
  const { data: stats } = useStats();

  const formatTime = (isoTime: string | null | undefined) => {
    if (!isoTime) return '未执行';
    try {
      const date = new Date(isoTime);
      return date.toLocaleString('zh-CN');
    } catch {
      return isoTime;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} 分 ${remainingSeconds} 秒`;
  };

  const getStatusBadge = (taskStatus: string, dryRun?: boolean) => {
    const badges: Record<
      string,
      {
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
        text: string;
        className?: string;
      }
    > = {
      running: { variant: 'default', text: '运行中', className: 'animate-pulse' },
      success: {
        variant: 'secondary',
        text: '成功',
        className: 'bg-green-100 text-green-700 hover:bg-green-100',
      },
      partial: {
        variant: 'secondary',
        text: '部分成功',
        className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
      },
      failed: { variant: 'destructive', text: '失败' },
    };
    const badge = badges[taskStatus] || { variant: 'outline' as const, text: taskStatus };
    return (
      <div className="flex items-center gap-2">
        {dryRun && (
          <Badge
            variant="outline"
            className="gap-1 text-xs bg-purple-50 text-purple-600 border-purple-200"
          >
            <FlaskConical className="w-3 h-3" />
            模拟
          </Badge>
        )}
        <Badge variant={badge.variant} className={badge.className}>
          {taskStatus === 'running' && (
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1.5" />
          )}
          {badge.text}
        </Badge>
      </div>
    );
  };

  // 优先使用 lastTask，回退到 lastRunStats
  const task = status?.lastTask;
  const hasTask = !!task;

  return (
    <div className="space-y-6">
      {/* 任务状态卡片 */}
      {status && (
        <Card className="@container/status overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${task?.status === 'running' ? 'bg-primary/10' : task?.status === 'failed' ? 'bg-red-100' : 'bg-green-100'}`}
                >
                  {task?.status === 'running' ? (
                    <Activity className="w-5 h-5 text-primary animate-pulse" />
                  ) : task?.status === 'failed' ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : task?.status === 'partial' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {task?.status === 'running' ? '当前任务' : '最近任务'}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {task?.status === 'running'
                      ? '任务正在执行中'
                      : hasTask
                        ? formatTime(task.startTime)
                        : '暂无任务记录'}
                  </CardDescription>
                </div>
              </div>
              {hasTask && getStatusBadge(task.status, task.dryRun)}
            </div>
          </CardHeader>
          {hasTask && (
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-2 @[640px]/status:grid-cols-5 gap-4">
                <div className="group cursor-default">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>相似度匹配</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl @[640px]/status:text-3xl font-bold text-blue-600 group-hover:scale-105 transition-transform">
                      {task.similarityMatched}
                    </p>
                    <span className="text-xs text-muted-foreground">个</span>
                  </div>
                </div>
                <div className="group cursor-default">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <Brain className="w-3.5 h-3.5 text-purple-500" />
                    <span>AI 分类</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl @[640px]/status:text-3xl font-bold text-purple-600 group-hover:scale-105 transition-transform">
                      {task.aiClassified}
                    </p>
                    <span className="text-xs text-muted-foreground">个</span>
                  </div>
                </div>
                <div className="group cursor-default">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span>总处理数</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl @[640px]/status:text-3xl font-bold text-green-600 group-hover:scale-105 transition-transform">
                      {task.filesProcessed}
                    </p>
                    <span className="text-xs text-muted-foreground">个</span>
                  </div>
                </div>
                <div className="group cursor-default">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Token 消耗</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl @[640px]/status:text-3xl font-bold text-amber-600 group-hover:scale-105 transition-transform">
                      {task.tokensUsed.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="group cursor-default">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    <span>执行时长</span>
                  </div>
                  <p className="text-lg @[640px]/status:text-xl font-semibold group-hover:scale-105 transition-transform">
                    {formatDuration(task.duration)}
                  </p>
                </div>
              </div>
              {task.errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700">{task.errorMessage}</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* 文件系统状态卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="group hover:shadow-md transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Database className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardDescription className="text-xs">分类库文件数</CardDescription>
                    <CardTitle className="text-xl md:text-2xl font-bold mt-1 group-hover:scale-105 transition-transform">
                      {stats?.files?.totalInRoot?.toLocaleString() || '0'}
                    </CardTitle>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="group hover:shadow-md transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <FileInput className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <CardDescription className="text-xs">待分类文件数</CardDescription>
                    <CardTitle className="text-xl md:text-2xl font-bold mt-1 group-hover:scale-105 transition-transform">
                      {stats?.files?.totalInIncoming?.toLocaleString() || '0'}
                    </CardTitle>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="group hover:shadow-md transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="pb-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <FolderOpen className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div>
                    <CardDescription className="text-xs">分类目录数</CardDescription>
                    <CardTitle className="text-xl md:text-2xl font-bold mt-1 group-hover:scale-105 transition-transform">
                      {stats?.files?.categories?.toLocaleString() || '0'}
                    </CardTitle>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {children}
    </div>
  );
}
