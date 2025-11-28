import React, { useState } from 'react';
import { useTaskDetail, useTaskLogs } from '../hooks/useApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Clock,
  FileText,
  Zap,
  Database,
  RefreshCw
} from 'lucide-react';

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

const LOG_LEVELS: Record<number, { label: string; color: string; bgColor: string }> = {
  10: { label: 'TRACE', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  20: { label: 'DEBUG', color: 'text-gray-600 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  30: { label: 'INFO', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  40: { label: 'WARN', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950' },
  50: { label: 'ERROR', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
  60: { label: 'FATAL', color: 'text-red-800 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900' },
};

export const TaskDetailView: React.FC<{
  taskId: string;
  onBack?: () => void;
}> = ({ taskId, onBack }) => {
  const [currentLogType, setCurrentLogType] = useState('main');

  const { data: task, error, isLoading } = useTaskDetail(taskId);
  const { data: logsData, isLoading: logsLoading } = useTaskLogs(taskId, currentLogType, 500);

  const logs = logsData?.logs || [];

  const renderLogLine = (log: string, index: number) => {
    try {
      const logObj = JSON.parse(log);
      const { time, level, msg, ...rest } = logObj;
      const levelInfo = LOG_LEVELS[level] || { label: `${level}`, color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-800' };
      const formattedTime = time ? formatTime(time) : '';

      return (
        <div key={index} className={`p-2 rounded text-xs md:text-sm ${levelInfo.bgColor} mb-1`}>
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{formattedTime}</span>
            <Badge variant="outline" className={`${levelInfo.color} text-xs`}>
              {levelInfo.label}
            </Badge>
            <span className="flex-1 break-words">{msg}</span>
          </div>
          {Object.keys(rest).length > 0 && (
            <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
              {JSON.stringify(rest, null, 2)}
            </pre>
          )}
        </div>
      );
    } catch {
      return (
        <div key={index} className="p-2 bg-muted rounded text-xs md:text-sm font-mono mb-1 break-all">
          {log}
        </div>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
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

  const StatusIcon = task.status === 'success'
    ? CheckCircle
    : task.status === 'failed'
    ? XCircle
    : task.status === 'running'
    ? RefreshCw
    : AlertCircle;

  const statusColor = task.status === 'success'
    ? 'text-green-600'
    : task.status === 'failed'
    ? 'text-red-600'
    : task.status === 'running'
    ? 'text-blue-600'
    : 'text-yellow-600';

  const fileTypeData = task.fileTypes 
    ? Object.entries(task.fileTypes).map(([type, count]) => ({
        type,
        count,
      }))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 md:gap-4 flex-wrap">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden md:inline">返回</span>
          </Button>
        )}
        <div className='flex flex-col md:flex-row md:items-center gap-1 md:gap-4 flex-1 min-w-0'>
          <h2 className="text-xl md:text-2xl font-bold">任务详情</h2>
          <p className="text-xs md:text-sm text-muted-foreground font-mono break-all">{task.taskId}</p>
        </div>
      </div>

      {/* 任务状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <StatusIcon className={`w-4 h-4 md:w-5 md:h-5 ${statusColor}`} />
            任务状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div>
              <div className="text-xs md:text-sm text-muted-foreground">开始时间</div>
              <div className="text-xs md:text-sm font-medium">{formatTime(task.startTime)}</div>
            </div>
            <div>
              <div className="text-xs md:text-sm text-muted-foreground">结束时间</div>
              <div className="text-xs md:text-sm font-medium">{formatTime(task.endTime)}</div>
            </div>
            <div>
              <div className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                执行时长
              </div>
              <div className="text-xs md:text-sm font-medium">{formatDuration(task.duration)}</div>
            </div>
            <div>
              <div className="text-xs md:text-sm text-muted-foreground">运行模式</div>
              <div>
                {task.dryRun ? (
                  <Badge variant="outline" className="text-xs">模拟运行</Badge>
                ) : (
                  <Badge className="text-xs">正式运行</Badge>
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

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1 text-xs md:text-sm">
              <FileText className="w-3 h-3 md:w-4 md:h-4" />
              处理文件总数
            </CardDescription>
            <CardTitle className="text-2xl md:text-3xl">{task.filesProcessed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs md:text-sm">相似度匹配</CardDescription>
            <CardTitle className="text-2xl md:text-3xl text-blue-600">{task.similarityMatched ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs md:text-sm">AI分类</CardDescription>
            <CardTitle className="text-2xl md:text-3xl text-purple-600">{task.aiClassified ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1 text-xs md:text-sm">
              <Zap className="w-3 h-3 md:w-4 md:h-4" />
              Token消耗
            </CardDescription>
            <CardTitle className="text-2xl md:text-3xl text-orange-600">
              {(task.tokensUsed ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 文件类型分布 */}
      {fileTypeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Database className="w-4 h-4 md:w-5 md:h-5" />
              文件类型分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {fileTypeData.map(({ type, count }) => (
                <div key={type} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-xs md:text-sm font-mono truncate">{type}</span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 任务日志 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">任务日志</CardTitle>
          <CardDescription className="text-xs md:text-sm">查看本次任务的详细执行日志</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={currentLogType} onValueChange={setCurrentLogType}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              {LOG_TYPES.map((type) => (
                <TabsTrigger key={type.value} value={type.value} className="text-xs md:text-sm">
                  <span className="hidden md:inline">{type.icon} </span>
                  {type.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOG_TYPES.map((type) => (
              <TabsContent key={type.value} value={type.value}>
                {logsLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    加载日志中...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    暂无日志
                  </div>
                ) : (
                  <div className="max-h-[400px] md:max-h-[600px] overflow-y-auto space-y-1">
                    {logs.map((log, index) => renderLogLine(log, index))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
