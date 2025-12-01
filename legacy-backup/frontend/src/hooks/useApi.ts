import useSWR, { type SWRConfiguration } from 'swr';
import {
  api,
  type Stats,
  type TaskStatus,
  type UsageStats,
  type TaskRecord,
  type TaskFileList,
} from '../api';

// SWR 配置
const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};

// 用于自动刷新的配置
const autoRefreshConfig: SWRConfiguration = {
  ...defaultConfig,
  refreshInterval: 10000, // 每 10 秒自动刷新
};

/**
 * 获取系统统计信息
 */
export function useStats(config?: SWRConfiguration) {
  return useSWR<Stats>('/api/stats', api.getStats, { ...defaultConfig, ...config });
}

/**
 * 获取任务状态（自动刷新）
 */
export function useStatus(config?: SWRConfiguration) {
  return useSWR<TaskStatus>('/api/status', api.getStatus, {
    ...autoRefreshConfig,
    ...config,
  });
}

/**
 * 获取使用统计（自动刷新）
 */
export function useUsageStats(
  range: 'today' | 'week' | 'month' | 'all' = 'all',
  config?: SWRConfiguration
) {
  return useSWR<UsageStats>(`/api/usage-stats?range=${range}`, () => api.getUsageStats(range), {
    ...autoRefreshConfig,
    ...config,
  });
}

/**
 * 获取任务历史
 */
export function useTaskHistory(config?: SWRConfiguration) {
  return useSWR<{ tasks: TaskRecord[] }>('/api/task-history', api.getTaskHistory, {
    ...defaultConfig,
    ...config,
  });
}

/**
 * 获取任务详情
 */
export function useTaskDetail(taskId: string | null, config?: SWRConfiguration) {
  return useSWR<TaskRecord>(
    taskId ? `/api/task/${taskId}` : null,
    taskId ? () => api.getTaskDetail(taskId) : null,
    { ...defaultConfig, ...config }
  );
}

/**
 * 获取任务日志
 */
export function useTaskLogs(
  taskId: string | null,
  type: string = 'main',
  limit: number = 200,
  config?: SWRConfiguration
) {
  return useSWR<{ logs: string[] }>(
    taskId ? `/api/task/${taskId}/logs?type=${type}&limit=${limit}` : null,
    taskId ? () => api.getTaskLogs(taskId, type, limit) : null,
    { ...defaultConfig, ...config }
  );
}

/**
 * 获取任务文件列表
 */
export function useTaskFiles(taskId: string | null, config?: SWRConfiguration) {
  return useSWR<TaskFileList>(
    taskId ? `/api/task/${taskId}/files` : null,
    taskId ? () => api.getTaskFiles(taskId) : null,
    { ...defaultConfig, ...config }
  );
}

/**
 * 实时获取任务文件列表（自动轮询）
 * @param taskId 任务ID
 * @param interval 轮询间隔（毫秒），默认2000ms（2秒）
 * @param enabled 是否启用轮询，默认true
 */
export function useTaskFilesRealtime(
  taskId: string | null,
  interval: number = 2000,
  enabled: boolean = true
) {
  return useSWR<TaskFileList>(
    taskId ? `/api/task/${taskId}/files` : null,
    taskId ? () => api.getTaskFiles(taskId) : null,
    {
      ...defaultConfig,
      refreshInterval: enabled ? interval : 0, // 启用时自动轮询
      revalidateOnFocus: true, // 窗口获得焦点时重新验证
      revalidateOnReconnect: true, // 重新连接时重新验证
    }
  );
}

/**
 * 获取日志
 */
export function useLogs(type: string, limit: number = 200, config?: SWRConfiguration) {
  return useSWR<{ logs: string[] }>(
    `/api/logs?type=${type}&limit=${limit}`,
    () => api.getLogs(type, limit),
    { ...defaultConfig, ...config }
  );
}

/**
 * 获取配置
 */
export function useConfig(config?: SWRConfiguration) {
  return useSWR('/api/config', api.getConfig, { ...defaultConfig, ...config });
}
