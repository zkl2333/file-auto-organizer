import React, { useEffect, useState } from 'react';
import { api, type TaskRecord } from '../api';
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

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
};

const formatTime = (isoTime: string): string => {
  try {
    const date = new Date(isoTime);
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
  { value: 'main', label: '主服务日志', icon: '📋' },
  { value: 'ai', label: 'AI分类日志', icon: '🤖' },
  { value: 'file-move', label: '文件移动日志', icon: '📁' },
  { value: 'file-scan', label: '文件扫描日志', icon: '🔍' },
  { value: 'file-info', label: '文件信息日志', icon: '📄' },
];

const LOG_LEVELS: Record<number, { label: string; color: string; bgColor: string }> = {
  10: { label: 'TRACE', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  20: { label: 'DEBUG', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  30: { label: 'INFO', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  40: { label: 'WARN', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  50: { label: 'ERROR', color: 'text-red-600', bgColor: 'bg-red-50' },
  60: { label: 'FATAL', color: 'text-red-800', bgColor: 'bg-red-100' },
};

export const TaskDetailView: React.FC<{ 
  taskId: string; 
  onBack?: () => void;
}> = ({ taskId, onBack }) => {
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentLogType, setCurrentLogType] = useState('main');
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTaskDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTaskDetail(taskId);
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (type: string) => {
    try {
      setLogsLoading(true);
      const data = await api.getTaskLogs(taskId, type, 500);
      setLogs(data.logs);
    } catch (err) {
      console.error('加载日志失败:', err);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadTaskDetail();
  }, [taskId]);

  useEffect(() => {
    loadLogs(currentLogType);
  }, [currentLogType, taskId]);

  const renderLogLine = (log: string, index: number) => {
    try {
      const logObj = JSON.parse(log);
      const { time, level, msg, ...rest } = logObj;
      const levelInfo = LOG_LEVELS[level] || { label: `${level}`, color: 'text-gray-600', bgColor: 'bg-gray-50' };
      const formattedTime = time ? formatTime(time) : '';

      return (
        <div key={index} className={`p-2 rounded text-sm ${levelInfo.bgColor} mb-1`}>
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground">{formattedTime}</span>
            <Badge variant="outline" className={`${levelInfo.color} text-xs`}>
              {levelInfo.label}
            </Badge>
            <span className="flex-1">{msg}</span>
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
        <div key={index} className="p-2 bg-gray-50 rounded text-sm font-mono mb-1">
          {log}
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || '任务不存在'}</AlertDescription>
      </Alert>
    );
  }

  const StatusIcon = task.status === 'success' 
    ? CheckCircle 
    : task.status === 'failed' 
    ? XCircle 
    : AlertCircle;

  const statusColor = task.status === 'success' 
    ? 'text-green-600' 
    : task.status === 'failed' 
    ? 'text-red-600' 
    : 'text-yellow-600';

  const fileTypeData = Object.entries(task.fileTypes).map(([type, count]) => ({
    type,
    count,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        )}
        <div className='flex items-center gap-4'>
          <h2 className="text-2xl font-bold">任务详情</h2>
          <p className="text-sm text-muted-foreground font-mono">{task.taskId}</p>
        </div>
      </div>

      {/* 任务状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${statusColor}`} />
            任务状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">开始时间</div>
              <div className="text-sm font-medium">{formatTime(task.startTime)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">结束时间</div>
              <div className="text-sm font-medium">{formatTime(task.endTime)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                执行时长
              </div>
              <div className="text-sm font-medium">{formatDuration(task.duration)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">运行模式</div>
              <div>
                {task.dryRun ? (
                  <Badge variant="outline">模拟运行</Badge>
                ) : (
                  <Badge>正式运行</Badge>
                )}
              </div>
            </div>
          </div>
          {task.errorMessage && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{task.errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              处理文件总数
            </CardDescription>
            <CardTitle className="text-3xl">{task.filesProcessed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>相似度匹配</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{task.similarityMatched}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>AI分类</CardDescription>
            <CardTitle className="text-3xl text-purple-600">{task.aiClassified}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              Token消耗
            </CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {task.tokensUsed.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 文件类型分布 */}
      {fileTypeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              文件类型分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {fileTypeData.map(({ type, count }) => (
                <div key={type} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-mono">{type}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 任务日志 */}
      <Card>
        <CardHeader>
          <CardTitle>任务日志</CardTitle>
          <CardDescription>查看本次任务的详细执行日志</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={currentLogType} onValueChange={setCurrentLogType}>
            <TabsList className="mb-4">
              {LOG_TYPES.map((type) => (
                <TabsTrigger key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOG_TYPES.map((type) => (
              <TabsContent key={type.value} value={type.value}>
                {logsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    加载日志中...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无日志
                  </div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto space-y-1">
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
