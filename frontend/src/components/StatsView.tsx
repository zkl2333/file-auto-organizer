import React, { useEffect, useState, useCallback } from 'react';
import { api, Stats, TaskStatus } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export const StatsView: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, statusData] = await Promise.all([
        api.getStats(),
        api.getStatus()
      ]);
      setStats(statsData);
      setStatus(statusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载统计信息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000); // 每 10 秒刷新
    return () => clearInterval(interval);
  }, [loadStats]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>加载失败: {error}</AlertDescription>
      </Alert>
    );
  }
  if (!stats) return null;

  const formatLastRunTime = (isoTime: string | null) => {
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

  return (
    <div className="space-y-6">
      {/* 任务状态卡片 */}
      {status && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>任务状态</CardTitle>
              <Badge variant={status.isRunning ? "default" : "secondary"}>
                {status.isRunning ? '运行中' : '空闲'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground">最近执行时间</Label>
                <p className="text-sm font-medium mt-1">{formatLastRunTime(status.lastRunTime)}</p>
              </div>
              {status.lastRunStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t">
                  <div>
                    <Label className="text-sm text-muted-foreground">相似度匹配</Label>
                    <p className="text-2xl font-bold text-blue-600">{status.lastRunStats.similarityMatched}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">AI 分类</Label>
                    <p className="text-2xl font-bold text-purple-600">{status.lastRunStats.aiClassified}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">总处理数</Label>
                    <p className="text-2xl font-bold text-green-600">{status.lastRunStats.totalProcessed}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">执行时长</Label>
                    <p className="text-lg font-semibold">{formatDuration(status.lastRunStats.duration)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 文件统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>分类库文件数</CardDescription>
            <CardTitle className="text-3xl">{stats.files.totalInRoot}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>待分类文件数</CardDescription>
            <CardTitle className="text-3xl">{stats.files.totalInIncoming}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>分类目录数</CardDescription>
            <CardTitle className="text-3xl">{stats.files.categories}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>目录信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>分类库目录</Label>
            <Input type="text" value={stats.directories.rootDir} readOnly />
            <p className={`text-sm ${stats.directories.rootDirExists ? 'text-green-600' : 'text-red-600'}`}>
              {stats.directories.rootDirExists ? '✓ 存在' : '✗ 不存在'}
            </p>
          </div>
          <div className="space-y-2">
            <Label>待分类目录</Label>
            <Input type="text" value={stats.directories.incomingDir} readOnly />
            <p className={`text-sm ${stats.directories.incomingDirExists ? 'text-green-600' : 'text-red-600'}`}>
              {stats.directories.incomingDirExists ? '✓ 存在' : '✗ 不存在'}
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

