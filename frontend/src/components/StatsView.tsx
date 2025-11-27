import React, { useEffect, useState, useCallback } from 'react';
import { api, type Stats, type TaskStatus, type UsageStats } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

type TimeRange = 'today' | 'week' | 'month' | 'all';

export const StatsView: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (range: TimeRange) => {
    try {
      setLoading(true);
      const [statsData, statusData, usageData] = await Promise.all([
        api.getStats(),
        api.getStatus(),
        api.getUsageStats(range)
      ]);
      setStats(statsData);
      setStatus(statusData);
      setUsageStats(usageData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载统计信息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats(timeRange);
    const interval = setInterval(() => loadStats(timeRange), 10000); // 每 10 秒刷新
    return () => clearInterval(interval);
  }, [loadStats, timeRange]);

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value as TimeRange);
  };

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

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN');
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
  if (!stats || !usageStats) return null;

  // 准备文件类型饼图数据
  const fileTypeData = Object.entries(usageStats.fileTypes)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8); // 只显示前8种

  // 颜色配置
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

  // 准备每日趋势数据
  const dailyTrendData = usageStats.dailyTrends.map(trend => ({
    date: trend.date,
    files: trend.filesProcessed,
    tokens: Math.round(trend.tokensUsed / 1000), // 转换为K
  }));

  return (
    <div className="space-y-6">
      {/* 时间范围选择 */}
      <Tabs value={timeRange} onValueChange={handleTimeRangeChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today">今日</TabsTrigger>
          <TabsTrigger value="week">7天</TabsTrigger>
          <TabsTrigger value="month">30天</TabsTrigger>
          <TabsTrigger value="all">全部</TabsTrigger>
        </TabsList>
      </Tabs>

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

      {/* 使用统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>AI 调用次数</CardDescription>
            <CardTitle className="text-3xl text-purple-600">{formatNumber(usageStats.totalAiCalls)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Token 消耗</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{formatNumber(usageStats.totalTokensUsed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>整理文件总数</CardDescription>
            <CardTitle className="text-3xl text-green-600">{formatNumber(usageStats.totalFilesProcessed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>文件类型种类</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{Object.keys(usageStats.fileTypes).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 当前文件统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>分类库文件数</CardDescription>
            <CardTitle className="text-2xl">{stats.files.totalInRoot}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>待分类文件数</CardDescription>
            <CardTitle className="text-2xl">{stats.files.totalInIncoming}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>分类目录数</CardDescription>
            <CardTitle className="text-2xl">{stats.files.categories}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 文件类型分布 */}
        <Card>
          <CardHeader>
            <CardTitle>文件类型分布</CardTitle>
            <CardDescription>显示前 8 种文件类型</CardDescription>
          </CardHeader>
          <CardContent>
            {fileTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={fileTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {fileTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 每日整理趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>每日整理趋势</CardTitle>
            <CardDescription>文件数量和 Token 消耗（K）</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => `日期: ${value}`}
                    formatter={(value, name) => {
                      if (name === 'files') return [value, '文件数'];
                      if (name === 'tokens') return [value, 'Token (K)'];
                      return [value, name];
                    }}
                  />
                  <Legend 
                    formatter={(value) => {
                      if (value === 'files') return '文件数';
                      if (value === 'tokens') return 'Token (K)';
                      return value;
                    }}
                  />
                  <Area type="monotone" dataKey="files" stackId="1" stroke="#8884d8" fill="#8884d8" />
                  <Area type="monotone" dataKey="tokens" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
