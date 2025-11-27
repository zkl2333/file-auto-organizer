import React, { useEffect, useState } from 'react';
import { api, Stats } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const StatsView: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.getStats();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || '加载统计信息失败');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>配置信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>定时任务</Label>
              <Input type="text" value={stats.config.cronSchedule} readOnly />
            </div>
            <div className="space-y-2">
              <Label>日志级别</Label>
              <Input type="text" value={stats.config.logLevel} readOnly />
            </div>
            <div className="space-y-2">
              <Label>相似度阈值</Label>
              <Input type="text" value={stats.config.similarityThreshold} readOnly />
            </div>
            <div className="space-y-2">
              <Label>AI批次大小</Label>
              <Input type="text" value={stats.config.aiBatchSize} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

