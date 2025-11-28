import React from 'react';
import { useTaskHistory } from '../hooks/useApi';
import type { TaskRecord } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Clock,
  FileText,
  Zap
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

const StatusBadge: React.FC<{ status: TaskRecord['status'] }> = ({ status }) => {
  switch (status) {
    case 'success':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          成功
        </Badge>
      );
    case 'partial':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          部分成功
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          失败
        </Badge>
      );
    case 'running':
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          运行中
        </Badge>
      );
  }
};

export const TaskHistoryView: React.FC<{ onViewDetail?: (taskId: string) => void }> = ({ onViewDetail }) => {
  const { data, error, isLoading, mutate } = useTaskHistory();

  const tasks = data?.tasks || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>任务执行历史</CardTitle>
              <CardDescription>查看所有任务的执行记录和统计信息</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error.message || '加载任务历史失败'}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无任务记录</div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务ID</TableHead>
                      <TableHead>开始时间</TableHead>
                      <TableHead className="text-center">状态</TableHead>
                      <TableHead className="text-right">耗时</TableHead>
                      <TableHead className="text-right">处理文件</TableHead>
                      <TableHead className="text-right">相似度匹配</TableHead>
                      <TableHead className="text-right">AI分类</TableHead>
                      <TableHead className="text-right">Token消耗</TableHead>
                      <TableHead className="text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.taskId}>
                        <TableCell className="font-mono text-xs">
                          {task.taskId.slice(-12)}
                          {task.dryRun && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              模拟
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatTime(task.startTime)}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={task.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">
                              {task.status === 'running' ? '运行中...' : formatDuration(task.duration)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{task.filesProcessed}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {task.similarityMatched}
                        </TableCell>
                        <TableCell className="text-right text-purple-600">
                          {task.aiClassified}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Zap className="w-3 h-3 text-orange-500" />
                            <span className="text-sm">{task.tokensUsed.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewDetail?.(task.taskId)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片列表 */}
              <div className="md:hidden space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.taskId}
                    className="border rounded-lg p-4 space-y-3 bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => onViewDetail?.(task.taskId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={task.status} />
                        {task.dryRun && (
                          <Badge variant="outline" className="text-xs">模拟</Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">任务ID</div>
                        <div className="font-mono text-xs">{task.taskId.slice(-12)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">耗时</div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>{formatDuration(task.duration)}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">处理文件</div>
                        <div className="font-medium">{task.filesProcessed}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Token</div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-orange-500" />
                          <span>{task.tokensUsed.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm border-t pt-2">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">相似度:</span>
                        <span className="text-blue-600 font-medium">{task.similarityMatched}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">AI:</span>
                        <span className="text-purple-600 font-medium">{task.aiClassified}</span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {formatTime(task.startTime)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
