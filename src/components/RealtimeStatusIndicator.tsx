'use client';

import { useEffect, useMemo, useState, startTransition } from 'react';
import useSWR from 'swr';
import { api, type TaskStatus, type TaskRecord } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity } from 'lucide-react';

interface RealtimeStatusIndicatorProps {
  className?: string;
  showText?: boolean;
}

export function RealtimeStatusIndicator({
  className,
  showText = false,
}: RealtimeStatusIndicatorProps) {
  const { data: status } = useSWR<TaskStatus>('/api/status', api.getStatus, {
    refreshInterval: 10000,
  });
  const isTaskRunning = status?.isRunning || false;

  const { data: historyData } = useSWR<{ tasks: TaskRecord[] }>(
    '/api/task-history',
    api.getTaskHistory,
    { refreshInterval: isTaskRunning ? 0 : 30000 }
  );
  const taskHistory = historyData?.tasks || [];

  const [lastUpdateTime, setLastUpdateTime] = useState(() => Date.now());

  useEffect(() => {
    startTransition(() => {
      setLastUpdateTime(Date.now());
    });
  }, [taskHistory.length]);

  const refreshStrategy = useMemo(
    () => ({
      statusRefreshInterval: isTaskRunning ? 2000 : 10000,
      historyRefreshInterval: isTaskRunning ? 0 : 60000,
    }),
    [isTaskRunning]
  );
  const mounted = typeof window !== 'undefined';

  // 避免 hydration 错误：在服务器端使用默认值
  const safeIsTaskRunning = mounted ? isTaskRunning : false;

  const getStatusColor = () => {
    if (safeIsTaskRunning) return 'default';
    return 'secondary';
  };

  const getStatusIcon = () => {
    if (safeIsTaskRunning) return <Activity className="w-3 h-3 animate-pulse" />;
    return null;
  };

  const getStatusText = () => {
    if (safeIsTaskRunning) return '实时更新中';
    return '空闲';
  };

  // 使用 useMemo 稳定 tooltip 内容，避免频繁更新导致无限循环
  // 对于时间戳，我们使用 Math.floor 来降低更新频率（每秒更新一次）
  const stableLastUpdateTime = useMemo(() => {
    return Math.floor(lastUpdateTime / 1000) * 1000;
  }, [lastUpdateTime]);

  const tooltipContent = useMemo(() => {
    if (safeIsTaskRunning) {
      return (
        <>
          <p className="text-sm">任务运行中，更新频率: {refreshStrategy.statusRefreshInterval}ms</p>
          <div className="text-xs text-muted-foreground mt-1">
            <div>• 状态更新: {refreshStrategy.statusRefreshInterval}ms</div>
            <div>• 历史更新: {refreshStrategy.historyRefreshInterval}ms</div>
          </div>
        </>
      );
    }
    return (
      <>
        <p className="text-sm">
          最后更新: {new Date(stableLastUpdateTime).toLocaleTimeString('zh-CN')}
        </p>
        <div className="text-xs text-muted-foreground mt-1">
          <div>• 状态更新: {refreshStrategy.statusRefreshInterval}ms</div>
          <div>• 历史更新: {refreshStrategy.historyRefreshInterval}ms</div>
        </div>
      </>
    );
  }, [
    safeIsTaskRunning,
    refreshStrategy.statusRefreshInterval,
    refreshStrategy.historyRefreshInterval,
    stableLastUpdateTime,
  ]);

  // 只在客户端渲染 Tooltip，避免 hydration 问题
  if (!mounted) {
    return (
      <Badge
        variant={getStatusColor()}
        className={`${className} gap-1.5 cursor-help transition-all duration-200`}
      >
        {getStatusIcon()}
        {showText && <span className="text-xs">{getStatusText()}</span>}
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={getStatusColor()}
          className={`${className} gap-1.5 cursor-help transition-all duration-200`}
        >
          {getStatusIcon()}
          {showText && <span className="text-xs">{getStatusText()}</span>}
          {safeIsTaskRunning && <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}

// 实时更新状态面板
export function RealtimeStatusPanel() {
  const { data: status } = useSWR<TaskStatus>('/api/status', api.getStatus, {
    refreshInterval: 10000,
  });
  const isTaskRunning = status?.isRunning || false;

  const { data: historyData } = useSWR<{ tasks: TaskRecord[] }>(
    '/api/task-history',
    api.getTaskHistory,
    { refreshInterval: isTaskRunning ? 0 : 30000 }
  );
  const taskHistory = historyData?.tasks || [];

  const [lastUpdateTime, setLastUpdateTime] = useState(() => Date.now());

  useEffect(() => {
    startTransition(() => {
      setLastUpdateTime(Date.now());
    });
  }, [taskHistory.length]);

  const refreshStrategy = useMemo(
    () => ({
      statusRefreshInterval: isTaskRunning ? 2000 : 10000,
      historyRefreshInterval: isTaskRunning ? 0 : 60000,
    }),
    [isTaskRunning]
  );

  return (
    <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">实时更新状态</h3>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">任务状态:</span>
          <span className={isTaskRunning ? 'text-green-600' : 'text-muted-foreground'}>
            {isTaskRunning ? '运行中' : '空闲'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">更新频率:</span>
          <span className="font-mono text-xs">{refreshStrategy.statusRefreshInterval}ms</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">最后更新:</span>
          <span className="font-mono text-xs">
            {new Date(lastUpdateTime).toLocaleTimeString('zh-CN')}
          </span>
        </div>

        {isTaskRunning && (
          <div className="flex items-center gap-2 text-green-600 text-xs pt-2 border-t">
            <Activity className="w-3 h-3 animate-pulse" />
            <span>任务正在进行实时监控...</span>
          </div>
        )}
      </div>
    </div>
  );
}
