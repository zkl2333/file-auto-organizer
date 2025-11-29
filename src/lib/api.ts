import {
  ApiResponse,
  TaskStatus,
  LogEntry,
  PaginatedResponse,
  DashboardStats,
  TaskConfig,
  FileProcessStatus,
  RouteParams,
} from '@/types';

// API 基础配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * 通用 API 请求函数
 */
async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 通用分页 API 请求函数
 */
async function paginatedRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<PaginatedResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

/**
 * 统计数据 API
 */
export const statsApi = {
  /**
   * 获取仪表板统计数据
   */
  getDashboardStats: (): Promise<ApiResponse<DashboardStats>> =>
    apiRequest<DashboardStats>('/api/stats'),

  /**
   * 获取使用统计
   */
  getUsageStats: (range: 'today' | 'week' | 'month' | 'all' = 'all'): Promise<ApiResponse> =>
    apiRequest(`/api/usage-stats?range=${range}`),
};

/**
 * 任务管理 API
 */
export const taskApi = {
  /**
   * 获取任务状态
   */
  getStatus: (): Promise<ApiResponse<TaskStatus>> => apiRequest<TaskStatus>('/api/status'),

  /**
   * 创建新任务
   */
  createTask: (
    config: Partial<TaskConfig>,
    dryRun: boolean = false
  ): Promise<ApiResponse<{ taskId: string }>> =>
    apiRequest(`/api/tasks?dryRun=${dryRun}`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  /**
   * 获取任务详情
   */
  getTaskDetail: (taskId: string): Promise<ApiResponse<FileProcessStatus>> =>
    apiRequest<FileProcessStatus>(`/api/tasks/${taskId}`),

  /**
   * 获取任务文件列表
   */
  getTaskFiles: (
    taskId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<FileProcessStatus>> =>
    paginatedRequest<FileProcessStatus>(`/api/tasks/${taskId}/files?page=${page}&limit=${limit}`),

  /**
   * 获取任务历史记录
   */
  getTaskHistory: (page: number = 1, limit: number = 20): Promise<PaginatedResponse<TaskStatus>> =>
    paginatedRequest<TaskStatus>(`/api/tasks/history?page=${page}&limit=${limit}`),

  /**
   * 删除任务
   */
  deleteTask: (taskId: string): Promise<ApiResponse> =>
    apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' }),

  /**
   * 批量删除任务
   */
  deleteTasks: (
    taskIds: string[]
  ): Promise<ApiResponse<{ deleted: string[]; notFound: string[] }>> =>
    apiRequest('/api/tasks', {
      method: 'DELETE',
      body: JSON.stringify({ taskIds }),
    }),

  /**
   * 取消正在运行的任务
   */
  cancelTask: (taskId: string): Promise<ApiResponse> =>
    apiRequest(`/api/tasks/${taskId}/cancel`, { method: 'POST' }),

  /**
   * 重试失败的任务
   */
  retryTask: (taskId: string): Promise<ApiResponse> =>
    apiRequest(`/api/tasks/${taskId}/retry`, { method: 'POST' }),
};

/**
 * 文件管理 API
 */
export const fileApi = {
  /**
   * 获取文件详情
   */
  getFileDetail: (fileId: string): Promise<ApiResponse<FileProcessStatus>> =>
    apiRequest<FileProcessStatus>(`/api/files/${fileId}`),

  /**
   * 获取文件列表
   */
  getFiles: (
    params: {
      status?: string;
      category?: string;
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ): Promise<PaginatedResponse<FileProcessStatus>> => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const query = searchParams.toString();
    return paginatedRequest<FileProcessStatus>(`/api/files${query ? `?${query}` : ''}`);
  },

  /**
   * 上传文件
   */
  uploadFile: async (file: File): Promise<ApiResponse<{ fileId: string; path: string }>> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('File upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  },

  /**
   * 移动文件到指定位置
   */
  moveFile: (fileId: string, targetPath: string): Promise<ApiResponse> =>
    apiRequest(`/api/files/${fileId}/move`, {
      method: 'POST',
      body: JSON.stringify({ targetPath }),
    }),

  /**
   * 删除文件
   */
  deleteFile: (fileId: string): Promise<ApiResponse> =>
    apiRequest(`/api/files/${fileId}`, { method: 'DELETE' }),

  /**
   * 重新分析文件
   */
  reanalyzeFile: (fileId: string): Promise<ApiResponse<any>> =>
    apiRequest<any>(`/api/files/${fileId}/analyze`, { method: 'POST' }),
};

/**
 * 配置管理 API
 */
export const configApi = {
  /**
   * 获取配置
   */
  getConfig: (): Promise<ApiResponse<TaskConfig>> => apiRequest<TaskConfig>('/api/config'),

  /**
   * 更新配置
   */
  updateConfig: (config: Partial<TaskConfig>): Promise<ApiResponse<TaskConfig>> =>
    apiRequest<TaskConfig>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  /**
   * 验证配置
   */
  validateConfig: (
    config: Partial<TaskConfig>
  ): Promise<ApiResponse<{ valid: boolean; errors: string[] }>> =>
    apiRequest<{ valid: boolean; errors: string[] }>('/api/config/validate', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  /**
   * 重置配置为默认值
   */
  resetConfig: (): Promise<ApiResponse<TaskConfig>> =>
    apiRequest<TaskConfig>('/api/config/reset', { method: 'POST' }),
};

/**
 * 日志管理 API
 */
export const logApi = {
  /**
   * 获取日志列表
   */
  getLogs: (
    params: {
      level?: string;
      taskId?: string;
      fileId?: string;
      limit?: number;
      offset?: number;
      startTime?: string;
      endTime?: string;
    } = {}
  ): Promise<ApiResponse<{ logs: LogEntry[]; total: number }>> => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const query = searchParams.toString();
    return apiRequest<{ logs: LogEntry[]; total: number }>(`/api/logs${query ? `?${query}` : ''}`);
  },

  /**
   * 获取任务日志
   */
  getTaskLogs: (taskId: string, limit: number = 200): Promise<ApiResponse<LogEntry[]>> =>
    apiRequest<LogEntry[]>(`/api/tasks/${taskId}/logs?limit=${limit}`),

  /**
   * 清理日志
   */
  clearLogs: (before?: string): Promise<ApiResponse<{ deletedCount: number }>> =>
    apiRequest<{ deletedCount: number }>('/api/logs/clear', {
      method: 'POST',
      body: JSON.stringify({ before }),
    }),
};

/**
 * 系统管理 API
 */
export const systemApi = {
  /**
   * 获取系统信息
   */
  getSystemInfo: (): Promise<
    ApiResponse<{
      version: string;
      uptime: number;
      memory: NodeJS.MemoryUsage;
      disk: { free: number; total: number };
    }>
  > => apiRequest('/api/system/info'),

  /**
   * 健康检查
   */
  healthCheck: (): Promise<ApiResponse<{ status: 'healthy' | 'unhealthy' }>> =>
    apiRequest('/api/health'),

  /**
   * 触发定时任务
   */
  triggerCronTask: (): Promise<ApiResponse> => apiRequest('/api/cron/trigger', { method: 'POST' }),
};

/**
 * WebSocket 连接管理（用于实时更新）
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(url: string = 'ws://localhost:3000/api/ws'): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        const listeners = this.listeners.get(type);
        if (listeners) {
          listeners.forEach((callback) => callback(data));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // 自动重连
      setTimeout(() => this.connect(), 5000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  subscribe(type: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(callback);

    // 返回取消订阅函数
    return () => {
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}

// 全局 WebSocket 实例
export const wsManager = new WebSocketManager();

// 自动连接（仅在客户端）
if (typeof window !== 'undefined') {
  wsManager.connect();
}
