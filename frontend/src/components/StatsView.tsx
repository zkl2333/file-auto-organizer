import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUsageStats } from "../hooks/useApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
} from "recharts";
import { useIsMobile } from "../hooks/use-mobile";
import { Brain, Zap, FileStack, FolderTree, Activity, Clock, TrendingUp } from "lucide-react";

type TimeRange = "today" | "week" | "month" | "all";

interface StatsViewProps {
  timeRange: TimeRange;
}

export const StatsView: React.FC<StatsViewProps> = ({ timeRange = "week" }) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // 获取使用统计数据（按时间范围）
  const { data: usageStats, error, isLoading: loading } = useUsageStats(timeRange);

  // 移动端自动切换到今日视图
  useEffect(() => {
    if (isMobile && timeRange === "month") {
      navigate("/stats/today", { replace: true });
    }
  }, [isMobile, timeRange, navigate]);

  const handleTimeRangeChange = (value: string) => {
    navigate(`/stats/${value}`, { replace: true });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("zh-CN");
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
    const errorMessage = error instanceof Error ? error.message : "加载统计信息失败";
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
    "oklch(0.6 0.118 184.704)",
    "oklch(0.398 0.07 227.392)",
    "oklch(0.828 0.189 84.429)",
    "oklch(0.769 0.188 70.08)",
    "oklch(0.646 0.222 41.116)",
    "oklch(0.6 0.118 184.704)",
    "oklch(0.398 0.07 227.392)",
    "oklch(0.828 0.189 84.429)",
    "oklch(0.769 0.188 70.08)",
    "oklch(0.646 0.222 41.116)",
    "oklch(0.6 0.118 184.704)",
    "oklch(0.398 0.07 227.392)",
    "oklch(0.828 0.189 84.429)",
    "oklch(0.769 0.188 70.08)",
  ];

  // 准备每日趋势数据
  const dailyTrendData = usageStats.dailyTrends.map((trend) => ({
    date: trend.date,
    files: trend.filesProcessed,
    tokens: Math.round(trend.tokensUsed / 1000), // 转换为K
  }));

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 - 时间范围选择 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">数据统计</h2>
          <p className="text-sm text-muted-foreground mt-1">实时追踪文件整理和 AI 使用情况</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={handleTimeRangeChange}
            variant="outline"
            className="hidden sm:flex"
          >
            <ToggleGroupItem value="today" className="gap-2">
              <Clock className="w-3.5 h-3.5" />
              今日
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              7天
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="gap-2">
              <Activity className="w-3.5 h-3.5" />
              30天
            </ToggleGroupItem>
            <ToggleGroupItem value="all">全部</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-32 sm:hidden" size="sm" aria-label="选择时间范围">
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

      {/* 使用统计卡片 - 优化设计 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-3 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                <Brain className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <CardDescription className="text-xs">AI 调用次数</CardDescription>
            <CardTitle className="text-2xl md:text-3xl font-bold text-purple-600 group-hover:scale-105 transition-transform">
              {formatNumber(usageStats.totalAiCalls)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-3 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                <Zap className="w-4 h-4 text-orange-600" />
              </div>
            </div>
            <CardDescription className="text-xs">Token 消耗</CardDescription>
            <CardTitle className="text-2xl md:text-3xl font-bold text-orange-600 group-hover:scale-105 transition-transform">
              {formatNumber(usageStats.totalTokensUsed)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-3 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <FileStack className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <CardDescription className="text-xs">整理文件总数</CardDescription>
            <CardTitle className="text-2xl md:text-3xl font-bold text-green-600 group-hover:scale-105 transition-transform">
              {formatNumber(usageStats.totalFilesProcessed)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-3 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <FolderTree className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <CardDescription className="text-xs">文件类型种类</CardDescription>
            <CardTitle className="text-2xl md:text-3xl font-bold text-blue-600 group-hover:scale-105 transition-transform">
              {Object.keys(usageStats.fileTypes).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 文件类型分布 */}
        <Card className="@container/chart group hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderTree className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">文件类型分布</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  <span className="hidden @[540px]/chart:inline">显示前 8 种最常见的文件类型</span>
                  <span className="@[540px]/chart:hidden">TOP 8 文件类型</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-2 sm:px-6 sm:pt-4">
            {fileTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280} className="md:h-[320px]">
                <PieChart>
                  <Pie
                    data={fileTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={isMobile ? 70 : 90}
                    fill="#8884d8"
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {fileTypeData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: number) => [`${value} 个文件`, "数量"]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] md:h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <FolderTree className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">暂无文件类型数据</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 每日整理趋势 */}
        <Card className="@container/chart group hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">每日整理趋势</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  <span className="hidden @[540px]/chart:inline">
                    文件处理数量和 Token 消耗趋势
                  </span>
                  <span className="@[540px]/chart:hidden">文件与 Token 趋势</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-2 sm:px-6 sm:pt-4">
            {dailyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280} className="md:h-[320px]">
                <AreaChart data={dailyTrendData}>
                  <defs>
                    <linearGradient id="fillFiles" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fillTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    opacity={0.3}
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
                      return date.toLocaleDateString("zh-CN", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickMargin={8} />
                  <Tooltip
                    cursor={{
                      stroke: "hsl(var(--border))",
                      strokeWidth: 1,
                      strokeDasharray: "5 5",
                    }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });
                    }}
                    formatter={(value, name) => {
                      if (name === "files") return [value, "文件数"];
                      if (name === "tokens") return [`${value}K`, "Token"];
                      return [value, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                    iconType="circle"
                    formatter={(value) => {
                      if (value === "files") return "文件数";
                      if (value === "tokens") return "Token (K)";
                      return value;
                    }}
                  />
                  <Area
                    dataKey="files"
                    type="natural"
                    fill="url(#fillFiles)"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    stackId="1"
                    animationBegin={0}
                    animationDuration={800}
                  />
                  <Area
                    dataKey="tokens"
                    type="natural"
                    fill="url(#fillTokens)"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    stackId="2"
                    animationBegin={200}
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] md:h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">暂无趋势数据</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
