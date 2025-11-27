import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// 日志级别映射
const LOG_LEVELS: Record<number, { label: string; color: string }> = {
  10: { label: 'TRACE', color: 'text-gray-500' },
  20: { label: 'DEBUG', color: 'text-gray-400' },
  30: { label: 'INFO', color: 'text-blue-500' },
  40: { label: 'WARN', color: 'text-yellow-500' },
  50: { label: 'ERROR', color: 'text-red-500' },
  60: { label: 'FATAL', color: 'text-red-700' },
};

// 格式化时间
const formatTime = (isoTime: string): string => {
  try {
    const date = new Date(isoTime);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoTime;
  }
};

export const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [type, setType] = useState('system');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getLogs(type);
      setLogs(data.logs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载日志失败');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  useEffect(() => {
    if (shouldAutoScroll.current && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const renderLogLine = (log: string, index: number) => {
    try {
      const logObj = JSON.parse(log);
      const { time, level, msg, module } = logObj;
      
      // 根据日志级别筛选
      if (levelFilter !== 'all' && level !== parseInt(levelFilter)) {
        return null;
      }
      
      const levelInfo = LOG_LEVELS[level] || { label: `${level}`, color: 'text-gray-400' };
      const formattedTime = time ? formatTime(time) : '';
      
      return (
        <div key={index} className="text-sm mb-1 font-mono">
          <span className="text-gray-500">[{formattedTime}]</span>
          {' '}
          <span className={`font-semibold ${levelInfo.color}`}>[{levelInfo.label}]</span>
          {module && (
            <>
              {' '}
              <span className="text-purple-400">[{module}]</span>
            </>
          )}
          {' '}
          <span className="text-gray-200">{msg}</span>
        </div>
      );
    } catch {
      return <div key={index} className="text-sm mb-1 text-gray-300 font-mono">{log}</div>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-4 flex gap-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择日志类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">系统日志</SelectItem>
            <SelectItem value="main">主服务日志</SelectItem>
            <SelectItem value="ai">AI分类日志</SelectItem>
            <SelectItem value="file-move">文件移动日志</SelectItem>
            <SelectItem value="file-scan">文件扫描日志</SelectItem>
            <SelectItem value="file-info">文件信息日志</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="日志级别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部级别</SelectItem>
            <SelectItem value="30">INFO</SelectItem>
            <SelectItem value="40">WARN</SelectItem>
            <SelectItem value="50">ERROR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{type} 日志</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs max-h-[600px] overflow-y-auto">
            {loading && logs.length === 0 ? (
              <div className="text-gray-400">加载中...</div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : logs.length === 0 ? (
              <div className="text-gray-400">暂无日志</div>
            ) : (
              logs.map(renderLogLine)
            )}
            <div ref={logsEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

