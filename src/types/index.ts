// 文件处理相关类型定义

export interface FileProcessStatus {
  id: string;
  fileName: string;
  currentPath: string;
  targetPath?: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'skipped';
  stage: FileProcessStage;
  error?: string;
  similarity?: number;
  metadata?: FileMetadata;
  aiAnalysis?: AIAnalysisResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileMetadata {
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  fileType: string;
  mimeType?: string;
  exifData?: Record<string, any>;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface AIAnalysisResult {
  category: string;
  confidence: number;
  suggestedPath: string;
  reasoning?: string;
  tags?: string[];
  similarFiles?: string[];
}

export type FileProcessStage =
  | 'scanning'
  | 'analyzing'
  | 'classifying'
  | 'moving'
  | 'verifying'
  | 'completed'
  | 'error';

export interface TaskStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  totalFiles: number;
  processedFiles: number;
  errors: number;
  startTime?: Date;
  endTime?: Date;
  dryRun: boolean;
  config: TaskConfig;
}

export interface TaskConfig {
  rootDir: string;
  incomingDir: string;
  similarityThreshold: number;
  aiProvider: 'openai' | 'claude';
  aiModel: string;
  enableMove: boolean;
  enableAI: boolean;
  enableSimilarityCheck: boolean;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 组件 Props 类型
export interface FileCardProps {
  file: FileProcessStatus;
  onViewDetails?: (file: FileProcessStatus) => void;
  onRetry?: (fileId: string) => void;
  selected?: boolean;
  onSelect?: (fileId: string, selected: boolean) => void;
}

export interface TaskMonitorProps {
  taskId: string;
  onUpdate?: (task: TaskStatus) => void;
}

export interface ConfigFormProps {
  config: TaskConfig;
  onChange: (config: TaskConfig) => void;
  onSave: (config: TaskConfig) => Promise<void>;
  disabled?: boolean;
}

// 统计数据类型
export interface DashboardStats {
  totalFiles: number;
  processedFiles: number;
  errorFiles: number;
  pendingFiles: number;
  categories: {
    [category: string]: number;
  };
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'file_processed' | 'task_completed' | 'error_occurred';
  description: string;
  timestamp: Date;
  details?: Record<string, any>;
}

// 日志类型
export interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  context?: {
    taskId?: string;
    fileId?: string;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

// 文件上传相关
export interface FileUploadResponse {
  success: boolean;
  file?: {
    id: string;
    name: string;
    size: number;
    path: string;
  };
  error?: string;
}

// 路由参数类型
export interface RouteParams {
  taskId?: string;
  fileId?: string;
  category?: string;
}
