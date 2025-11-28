import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, Search, Copy, ChevronDown, ChevronRight, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

// 日志级别映射
const LOG_LEVELS: Record<number, { label: string; color: string; bgColor: string }> = {
  10: { label: 'TRACE', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  20: { label: 'DEBUG', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  30: { label: 'INFO', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  40: { label: 'WARN', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  50: { label: 'ERROR', color: 'text-red-600', bgColor: 'bg-red-50' },
  60: { label: 'FATAL', color: 'text-red-800', bgColor: 'bg-red-100' },
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
  const [logs, setLogs] = useState<string[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<string[]>([]);
  const [type, setType] = useState('file-move');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

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
    setShowScrollButton(!atBottom && filteredLogs.length > 0);

    return atBottom;
  }, [filteredLogs.length]);

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

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getLogs(type, 500);
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
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [loadLogs, autoRefresh]);

  // 过滤日志
  useEffect(() => {
    let filtered = logs;

    // 级别过滤
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => {
        try {
          const logObj = JSON.parse(log);
          return logObj.level === parseInt(levelFilter);
        } catch {
          return true;
        }
      });
    }

    // 搜索过滤
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(log => log.toLowerCase().includes(lowerSearch));
    }

    setFilteredLogs(filtered);
  }, [logs, levelFilter, searchTerm]);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
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

  const renderLogLine = (log: string, index: number) => {
    try {
      const logObj = JSON.parse(log);
      const { time, level, msg, module, ...rest } = logObj;

      const levelInfo = LOG_LEVELS[level] || { label: `${level}`, color: 'text-gray-600', bgColor: 'bg-gray-50' };
      const formattedTime = time ? formatTime(time) : '';
      const isExpanded = expandedLogs.has(index);
      const hasExtraData = Object.keys(rest).length > 0;

      // 提取关键信息用于特殊显示
      const { file, from, to, method, reasoning, similarity, score, similar, ...otherData } = rest;

      return (
        <div key={index} className={`mb-2 p-3 rounded-lg border ${levelInfo.bgColor} hover:shadow-md transition-shadow`}>
          <div className="flex items-start gap-2">
            {hasExtraData && (
              <button
                onClick={() => toggleExpand(index)}
                className="mt-1 text-gray-400 hover:text-gray-600 shrink-0"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500 font-mono text-xs">{formattedTime}</span>
                <Badge variant="outline" className={levelInfo.color}>{levelInfo.label}</Badge>
                {module && <Badge variant="secondary" className="text-xs">{module}</Badge>}
                {method && <Badge variant="default" className="text-xs bg-purple-100 text-purple-700">{method}</Badge>}
              </div>

              <div className="mt-1 text-sm text-gray-800 font-medium">
                {msg}
              </div>

              {/* 显示关键字段 */}
              {(file || from || to || similarity !== undefined || score !== undefined || similar) && (
                <div className="mt-2 space-y-1 text-xs">
                  {file && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 font-semibold">文件:</span>
                      <span className="text-blue-600 font-mono">{file}</span>
                    </div>
                  )}
                  {from && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 font-semibold">源:</span>
                      <span className="text-gray-700 font-mono truncate" title={from as string}>{from as string}</span>
                    </div>
                  )}
                  {to && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 font-semibold">目标:</span>
                      <span className="text-green-600 font-mono truncate" title={to as string}>{to as string}</span>
                    </div>
                  )}
                  {(similarity !== undefined || score !== undefined) && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 font-semibold">相似度:</span>
                      <span className="text-orange-600 font-semibold">
                        {(similarity || score) ? Number(similarity || score).toFixed(4) : 'N/A'}
                      </span>
                      {similar && <span className="text-gray-500">← {similar as string}</span>}
                    </div>
                  )}
                  {reasoning && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 font-semibold">理由:</span>
                      <span className="text-gray-700 italic">{reasoning as string}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 展开显示完整数据 */}
              {isExpanded && Object.keys(otherData).length > 0 && (
                <div className="mt-2 p-2 bg-gray-800 text-gray-100 rounded text-xs font-mono overflow-x-auto">
                  <pre>{JSON.stringify(otherData, null, 2)}</pre>
                </div>
              )}
            </div>

            <button
              onClick={() => copyToClipboard(log)}
              className="shrink-0 text-gray-400 hover:text-gray-600 p-1"
              title="复制日志"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      );
    } catch {
      // 无法解析的日志，使用原始显示
      return (
        <div key={index} className="mb-2 p-2 bg-gray-50 rounded border text-sm text-gray-700 font-mono">
          {log}
        </div>
      );
    }
  };

  const currentLogType = LOG_TYPES.find(t => t.value === type);

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择日志类型" />
          </SelectTrigger>
          <SelectContent>
            {LOG_TYPES.map(logType => (
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder="搜索日志内容..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadLogs}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>

        <Button
          variant={autoRefresh ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? '✓ 自动刷新' : '自动刷新'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={downloadLogs}
          disabled={logs.length === 0}
        >
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
                maxHeight: '800px'
              }}
            >
              {loading && logs.length === 0 ? (
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
                  {filteredLogs.map(renderLogLine)}
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
