import { useEffect, useState, useCallback } from 'react';
import { useStatus, useTaskHistory } from '@/hooks/useApi';

/**
 * 系统状态实时更新 Hook
 */
export function useSystemStatusRealtime(_interval: number = 5000) {
  const { data: status, error, isLoading, mutate } = useStatus();

  // 手动刷新状态
  const refreshStatus = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    status,
    error,
    isLoading,
    refreshStatus,
  };
}

/**
 * 任务历史实时更新 Hook
 * 当新任务完成时自动刷新
 */
export function useTaskHistoryRealtime(enabled: boolean = true, interval: number = 30000) {
  const { data, error, isLoading, mutate } = useTaskHistory(
    enabled ? { refreshInterval: interval } : { refreshInterval: 0 }
  );

  // 手动刷新任务历史
  const refreshHistory = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    taskHistory: data?.tasks || [],
    error,
    isLoading,
    refreshHistory,
  };
}

/**
 * 智能实时更新管理 Hook
 * 根据任务状态自动调整更新频率
 */
export function useSmartRealtimeUpdates() {
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  const { status, error, isLoading, refreshStatus } = useSystemStatusRealtime();
  const { taskHistory, refreshHistory } = useTaskHistoryRealtime(!isTaskRunning);

  useEffect(() => {
    if (status?.isRunning !== isTaskRunning) {
      setIsTaskRunning(status?.isRunning || false);
    }
  }, [status?.isRunning, isTaskRunning]);

  useEffect(() => {
    setLastUpdateTime(Date.now());
  }, [taskHistory]);

  // 根据任务状态自动调整更新策略
  const refreshStrategy = {
    // 如果有任务在运行，更频繁地更新状态
    statusRefreshInterval: isTaskRunning ? 2000 : 10000,
    // 如果没有任务在运行，减少历史更新频率
    historyRefreshInterval: isTaskRunning ? 0 : 60000,
  };

  return {
    status,
    taskHistory,
    isTaskRunning,
    lastUpdateTime,
    error,
    isLoading,
    refreshStatus,
    refreshHistory,
    refreshStrategy,
  };
}

/**
 * 任务完成通知 Hook
 * 监听任务状态变化，在任务完成时触发通知
 */
export function useTaskCompletionNotification(taskId: string) {
  const { data: status } = useStatus();
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);

  useEffect(() => {
    if (status?.currentTaskId === taskId) {
      const currentStatus = status?.isRunning ? 'running' : 'completed';

      // 如果状态从运行中变为完成，触发通知
      if (previousStatus === 'running' && currentStatus === 'completed') {
        onTaskCompleted(taskId);
      }

      setPreviousStatus(currentStatus);
    }
  }, [status?.isRunning, status?.currentTaskId, taskId, previousStatus]);
}

function onTaskCompleted(taskId: string) {
  // 使用浏览器通知 API
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('文件整理任务完成', {
      body: `任务 ${taskId} 已完成`,
      icon: '/favicon.ico',
    });
  }

  // 或者使用自定义通知系统
  console.log(`任务 ${taskId} 已完成`);
}

/**
 * 连接状态管理 Hook
 * 监听网络连接状态，在重新连接时自动刷新数据
 */
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // 重新连接时刷新所有数据
      window.dispatchEvent(new CustomEvent('app-reconnect'));
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
    return undefined;
  }, []);

  return {
    isOnline,
  };
}
