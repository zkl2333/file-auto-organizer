import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [type, setType] = useState('system');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [type]);

  const loadLogs = async () => {
    try {
      const data = await api.getLogs(type);
      setLogs(data.logs);
      setError(null);
    } catch (err: any) {
      setError(err.message || '加载日志失败');
    }
  };

  const renderLogLine = (log: string, index: number) => {
    try {
      const logObj = JSON.parse(log);
      const { time, level, msg } = logObj;
      const levelColor = 
        level === 30 ? 'text-blue-500' : 
        level === 40 ? 'text-yellow-500' : 
        level === 50 ? 'text-red-500' : 'text-gray-400';
      
      return (
        <div key={index} className={`text-sm mb-1 ${levelColor}`}>
          [{time}] [{level}] {msg}
        </div>
      );
    } catch {
      return <div key={index} className="text-sm mb-1 text-gray-300">{log}</div>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
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

