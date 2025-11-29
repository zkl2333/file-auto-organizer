'use client';

import React from 'react';
import { useConnectionStatus, useSmartRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, Activity, Clock } from 'lucide-react';

interface RealtimeStatusIndicatorProps {
  className?: string;
  showText?: boolean;
}

export function RealtimeStatusIndicator({
  className,
  showText = false,
}: RealtimeStatusIndicatorProps) {
  const { isOnline } = useConnectionStatus();
  const { isTaskRunning, lastUpdateTime, refreshStrategy } = useSmartRealtimeUpdates();

  const getStatusColor = () => {
    if (!isOnline) return 'destructive';
    if (isTaskRunning) return 'default';
    return 'secondary';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-3 h-3" />;
    if (isTaskRunning) return <Activity className="w-3 h-3 animate-pulse" />;
    return <Wifi className="w-3 h-3" />;
  };

  const getStatusText = () => {
    if (!isOnline) return '离线';
    if (isTaskRunning) return '实时更新中';
    return '在线';
  };

  const getTooltipText = () => {
    if (!isOnline) return '网络连接已断开';
    if (isTaskRunning) {
      return `任务运行中，更新频率: ${refreshStrategy.statusRefreshInterval}ms`;
    }
    return `最后更新: ${new Date(lastUpdateTime).toLocaleTimeString('zh-CN')}`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={getStatusColor()}
          className={`${className} gap-1.5 cursor-help transition-all duration-200`}
        >
          {getStatusIcon()}
          {showText && <span className="text-xs">{getStatusText()}</span>}
          {isTaskRunning && <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">{getTooltipText()}</p>
        <div className="text-xs text-muted-foreground mt-1">
          {isOnline && (
            <>
              <div>• 状态更新: {refreshStrategy.statusRefreshInterval}ms</div>
              <div>• 历史更新: {refreshStrategy.historyRefreshInterval}ms</div>
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// 实时更新状态面板
export function RealtimeStatusPanel() {
  const { isOnline } = useConnectionStatus();
  const { isTaskRunning, lastUpdateTime, refreshStrategy } = useSmartRealtimeUpdates();

  return (
    <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">实时更新状态</h3>
        <Badge variant={isOnline ? 'default' : 'destructive'} className="gap-1">
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? '在线' : '离线'}
        </Badge>
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

// 网络状态横幅
export function NetworkStatusBanner() {
  const { isOnline } = useConnectionStatus();

  if (isOnline) return null;

  return (
    <div className="w-full bg-destructive/10 border-b border-destructive/20 p-2">
      <div className="container mx-auto flex items-center gap-2 text-sm text-destructive">
        <WifiOff className="w-4 h-4" />
        <span>网络连接已断开，部分功能可能无法正常使用</span>
      </div>
    </div>
  );
}
