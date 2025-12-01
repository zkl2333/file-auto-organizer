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

  const getStatusColor = () => {
    if (isTaskRunning) return 'default';
    return 'secondary';
  };

  const getStatusIcon = () => {
    if (isTaskRunning) return <Activity className="w-3 h-3 animate-pulse" />;
    return null;
  };

  const getStatusText = () => {
    if (isTaskRunning) return '实时更新中';
    return '空闲';
  };

  const tooltipContent = useMemo(() => {
    if (isTaskRunning) {
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
        <p className="text-sm">最后更新: {new Date(lastUpdateTime).toLocaleTimeString('zh-CN')}</p>
        <div className="text-xs text-muted-foreground mt-1">
          <div>• 状态更新: {refreshStrategy.statusRefreshInterval}ms</div>
          <div>• 历史更新: {refreshStrategy.historyRefreshInterval}ms</div>
        </div>
      </>
    );
  }, [
    isTaskRunning,
    refreshStrategy.statusRefreshInterval,
    refreshStrategy.historyRefreshInterval,
    lastUpdateTime,
  ]);

  if (!isTaskRunning) return null;

  return (
    <Tooltip>
      <TooltipTrigger className={className}>
        <Badge
          variant={getStatusColor()}
          className="gap-1.5 cursor-help transition-all duration-200"
        >
          {getStatusIcon()}
          {showText && <span className="text-xs">{getStatusText()}</span>}
          {isTaskRunning && <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}
