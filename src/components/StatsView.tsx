'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUsageStats } from '@/hooks/useApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Brain,
  Zap,
  FileStack,
  FolderTree,
  Activity,
  Clock,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Target,
  BarChart3,
} from 'lucide-react';
import { StatCard } from './stat-card';
import { FileIcon } from './FileIcon';

type TimeRange = 'today' | 'week' | 'month' | 'all';

interface StatsViewProps {
  timeRange: TimeRange;
}

export const StatsView: React.FC<StatsViewProps> = ({ timeRange = 'week' }) => {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 获取使用统计数据（按时间范围）
  const { data: usageStats, error, isLoading: loading, mutate } = useUsageStats(timeRange);

  // 移动端自动切换到今日视图
  useEffect(() => {
    if (isMobile && timeRange === 'month') {
      router.replace('/stats/today');
    }
  }, [isMobile, timeRange, router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleTimeRangeChange = (value: string) => {
    router.replace(`/stats/${value}`);
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
    const errorMessage = error instanceof Error ? error.message : '加载统计信息失败';
    return (
      <Alert variant="destructive">
        <AlertDescription>加载失败: {errorMessage}</AlertDescription>
      </Alert>
    );
  }
  if (!usageStats) return null;

  // 准备文件类型饼图数据
  const fileTypeData = usageStats.fileTypes
    ? Object.entries(usageStats.fileTypes)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8) // 只显示前8种
    : [];

  // 优化的颜色配置 - 使用现代渐变色系
  const COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'var(--chart-6)',
    'var(--chart-7)',
    'var(--chart-8)',
    'var(--chart-9)',
    'var(--chart-10)',
  ];

  // 准备每日趋势数据
  const dailyTrendData = usageStats.dailyTrends.map((trend) => ({
    date: trend.date,
    files: trend.filesProcessed,
    tokens: Math.round(trend.tokensUsed / 1000), // 转换为K
  }));

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 - 现代设计 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            数据统计
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            实时追踪文件整理和 AI 使用情况
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2 hover:bg-muted/50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">刷新</span>
          </Button>
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={handleTimeRangeChange}
            variant="outline"
            className="hidden sm:flex"
          >
            <ToggleGroupItem value="today" className="gap-2 text-xs">
              <Clock className="w-3.5 h-3.5" />
              今日
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="gap-2 text-xs">
              <TrendingUp className="w-3.5 h-3.5" />
              7天
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="gap-2 text-xs">
              <Activity className="w-3.5 h-3.5" />
              30天
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="text-xs">
              全部
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-28 sm:hidden" size="sm" aria-label="选择时间范围">
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="today" className="rounded-lg">
                今日
              </SelectItem>
              <SelectItem value="week" className="rounded-lg">
                7天
              </SelectItem>
              <SelectItem value="month" className="rounded-lg">
                30天
              </SelectItem>
              <SelectItem value="all" className="rounded-lg">
                全部
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 使用统计卡片 - 现代 shadcn 风格 */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="AI 调用次数"
          value={usageStats.totalAiCalls}
          unit="次"
          icon={Brain}
          badge="AI"
          theme="purple"
          formatValue={formatNumber}
          footer={
            <div className="w-full bg-purple-200/50 dark:bg-purple-800/30 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-600 h-1.5 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(100, (usageStats.totalAiCalls / 100) * 100)}%`,
                }}
              />
            </div>
          }
        />

        <StatCard
          title="Token 消耗"
          value={usageStats.totalTokensUsed}
          unit="个"
          icon={Zap}
          badge="Token"
          theme="orange"
          formatValue={formatNumber}
          footer={
            <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
              <Sparkles className="w-3 h-3" />
              <span>约 {(usageStats.totalTokensUsed / 1000).toFixed(1)}K</span>
            </div>
          }
        />

        <StatCard
          title="整理文件总数"
          value={usageStats.totalFilesProcessed}
          unit="个"
          icon={FileStack}
          badge="文件"
          theme="green"
          formatValue={formatNumber}
          footer={
            <div className="w-full bg-green-200/50 dark:bg-green-800/30 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(100, (usageStats.totalFilesProcessed / 1000) * 100)}%`,
                }}
              />
            </div>
          }
        />

        <StatCard
          title="文件类型种类"
          value={Object.keys(usageStats.fileTypes).length}
          unit="种"
          icon={FolderTree}
          badge="类型"
          theme="blue"
          footer={
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-3 h-3" />
              <span>多样化 {Object.keys(usageStats.fileTypes).length > 5 ? '丰富' : '适中'}</span>
            </div>
          }
        />
      </div>

      {/* 图表区域 - 现代设计 */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        {/* 文件类型分布图表 */}
        <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold">文件类型分布</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    TOP 8 最常见的文件类型统计
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="hidden sm:flex">
                {fileTypeData.length} 种类型
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-0 sm:px-6">
            {fileTypeData.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={320} className="hidden sm:block">
                  <PieChart>
                    <Pie
                      data={fileTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1000}
                      animationEasing="ease-out"
                    >
                      {fileTypeData.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          className="hover:opacity-80 transition-all duration-200 cursor-pointer hover:scale-105"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid hsl(var(--border))',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        backgroundColor: 'hsl(var(--background))',
                      }}
                      formatter={(value: number, name: string) => [
                        <span className="font-semibold">{value} 个文件</span>,
                        name,
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }}
                      iconType="circle"
                      verticalAlign="bottom"
                      height={36}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* 移动端简化的列表展示 */}
                <div className="sm:hidden space-y-3">
                  {fileTypeData.slice(0, 5).map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <FileIcon
                          extension={item.name}
                          size="w-4 h-4"
                          className="text-muted-foreground shrink-0"
                        />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">{item.value}</div>
                        <div className="text-xs text-muted-foreground">
                          {(
                            (item.value / fileTypeData.reduce((sum, curr) => sum + curr.value, 0)) *
                            100
                          ).toFixed(1)}
                          %
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <FolderTree className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium">暂无文件类型数据</p>
                <p className="text-xs text-muted-foreground mt-1">开始整理文件后将显示统计信息</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 每日整理趋势图表 */}
        <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 text-white shadow-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold">每日整理趋势</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    文件处理数量和 Token 消耗趋势
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="hidden sm:flex">
                {dailyTrendData.length} 天数据
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-0 sm:px-6">
            {dailyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart
                  data={dailyTrendData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillFiles" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    opacity={0.2}
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                    minTickGap={32}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                      });
                    }}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickMargin={8} />
                  <Tooltip
                    cursor={{
                      stroke: 'hsl(var(--border))',
                      strokeWidth: 1,
                      strokeDasharray: '5 5',
                    }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      backgroundColor: 'hsl(var(--background))',
                    }}
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      });
                    }}
                    formatter={(value, name) => {
                      if (name === 'files')
                        return [<span className="font-semibold">{value}</span>, '文件数'];
                      if (name === 'tokens')
                        return [<span className="font-semibold">{value}K</span>, 'Token'];
                      return [value, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }}
                    iconType="line"
                    formatter={(value) => {
                      if (value === 'files') return '📁 文件数';
                      if (value === 'tokens') return '⚡ Token (K)';
                      return value;
                    }}
                  />
                  <Area
                    dataKey="files"
                    type="monotone"
                    fill="url(#fillFiles)"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2.5}
                    animationBegin={0}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Area
                    dataKey="tokens"
                    type="monotone"
                    fill="url(#fillTokens)"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2.5}
                    animationBegin={300}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium">暂无趋势数据</p>
                <p className="text-xs text-muted-foreground mt-1">需要至少一天的数据才能显示趋势</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
