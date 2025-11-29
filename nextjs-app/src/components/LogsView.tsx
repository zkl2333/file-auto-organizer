'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLogs } from '@/hooks/useApi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, Search, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { LogRenderer } from './LogRenderer';

// 日志类型配置
const LOG_TYPES = [
  { value: 'system', label: '系统日志', icon: '⚙️' },
  { value: 'main', label: '主服务日志', icon: '📋' },
  { value: 'ai', label: 'AI分类日志', icon: '🤖' },
  { value: 'file-move', label: '文件移动日志', icon: '📁' },
  { value: 'file-scan', label: '文件扫描日志', icon: '🔍' },
  { value: 'file-info', label: '文件信息日志', icon: '📄' },
];

export const LogsView: React.FC = () => {
  const [type, setType] = useState('file-move');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    data: logsData,
    error,
    isLoading,
    mutate,
  } = useLogs(type, 500, {
    refreshInterval: autoRefresh ? 5000 : 0,
  });

  const logs = logsData?.logs || [];
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // 检查是否滚动到底部
  const checkIfAtBottom = useCallback(() => {
    const container = logsContainerRef.current;
    if (!container) return true;

    const threshold = 50; // 50px 的阈值
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < threshold;

    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom && logs.length > 0);

    return atBottom;
  }, [logs.length]);

  // 监听滚动事件
  useEffect(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfAtBottom();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [checkIfAtBottom]);

  // 滚动到底部
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    logsEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // 过滤日志
  const filteredLogs = logs.filter((log) => {
    // 级别过滤
    if (levelFilter !== 'all') {
      try {
        const logObj = JSON.parse(log);
        if (logObj.level !== parseInt(levelFilter)) {
          return false;
        }
      } catch {
        // 如果无法解析 JSON，跳过级别过滤
      }
    }

    // 搜索过滤
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      if (!log.toLowerCase().includes(lowerSearch)) {
        return false;
      }
    }

    return true;
  });

  // 智能自动滚动 - 仅在用户在底部时触发
  useEffect(() => {
    if (isAtBottom && filteredLogs.length > 0) {
      // 使用 setTimeout 确保 DOM 更新后再滚动
      setTimeout(() => {
        scrollToBottom('smooth');
      }, 100);
    }
  }, [filteredLogs, isAtBottom, scrollToBottom]);

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('日志已下载');
  };

  const currentLogType = LOG_TYPES.find((t) => t.value === type);

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择日志类型" />
          </SelectTrigger>
          <SelectContent>
            {LOG_TYPES.map((logType) => (
              <SelectItem key={logType.value} value={logType.value}>
                {logType.icon} {logType.label}
              </SelectItem>
            ))}
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

        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={16}
          />
          <Input
            placeholder="搜索日志内容..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>

        <Button
          variant={autoRefresh ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? '✓ 自动刷新' : '自动刷新'}
        </Button>

        <Button variant="outline" size="sm" onClick={downloadLogs} disabled={logs.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          下载
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {currentLogType?.icon} {currentLogType?.label}
              </CardTitle>
              <CardDescription className="mt-1">
                共 {logs.length} 条日志
                {filteredLogs.length !== logs.length && ` · 筛选后 ${filteredLogs.length} 条`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div
              ref={logsContainerRef}
              className="bg-white border rounded-lg p-4 overflow-y-auto"
              style={{
                height: 'calc(100vh - 290px)',
                minHeight: '400px',
                maxHeight: '800px',
              }}
            >
              {isLoading && logs.length === 0 ? (
                <div className="text-center text-gray-400 py-8">加载中...</div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  {logs.length === 0 ? '暂无日志' : '未找到匹配的日志'}
                </div>
              ) : (
                <>
                  {filteredLogs.map((log, index) => (
                    <div key={index} className="mb-2">
                      <LogRenderer
                        log={log}
                        index={index}
                        expandedLogs={expandedLogs}
                        onToggleExpand={toggleExpand}
                        showCopyButton={true}
                      />
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>

            {/* 滚动到底部按钮 */}
            {showScrollButton && (
              <Button
                size="sm"
                className="absolute bottom-6 right-6 rounded-full shadow-lg hover:shadow-xl transition-all"
                onClick={() => scrollToBottom('smooth')}
                title="滚动到底部"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LogsView;
