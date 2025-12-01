'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { api, type TaskStatus } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export const TriggerView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    error?: string;
  } | null>(null);
  const [cronToggling, setCronToggling] = useState(false);
  const [cronMessage, setCronMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 使用 useSWR 获取状态
  const { data: status, mutate: refreshStatus } = useSWR<TaskStatus>('/api/status', api.getStatus, {
    refreshInterval: 10000,
  });
  const cronEnabled = status?.cronEnabled;

  // 任务完成通知
  const previousStatusRef = useRef<string | null>(null);
  const currentTaskId = status?.currentTaskId || '';

  const onTaskCompleted = useCallback((taskId: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('文件整理任务完成', {
        body: `任务 ${taskId} 已完成`,
        icon: '/favicon.ico',
      });
    }
    console.log(`任务 ${taskId} 已完成`);
  }, []);

  useEffect(() => {
    if (status?.currentTaskId === currentTaskId && currentTaskId) {
      const currentStatus = status?.isRunning ? 'running' : 'completed';
      if (previousStatusRef.current === 'running' && currentStatus === 'completed') {
        onTaskCompleted(currentTaskId);
      }
      previousStatusRef.current = currentStatus;
    }
  }, [status?.isRunning, status?.currentTaskId, currentTaskId, onTaskCompleted]);

  const handleTrigger = async () => {
    setLoading(true);
    setResult({ success: true, message: '任务执行中，请稍候...' });

    try {
      const res = await api.triggerTask(dryRun);
      setResult(res);
      // 触发后刷新状态
      refreshStatus();
    } catch (err) {
      setResult({
        success: false,
        message: '请求失败',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCronToggle = async (enabled: boolean) => {
    setCronToggling(true);
    setCronMessage(null);

    try {
      const res = await api.toggleCron(enabled);
      // 刷新状态
      refreshStatus();
      setCronMessage({ type: 'success', text: res.message });
      setTimeout(() => setCronMessage(null), 3000);
    } catch (err) {
      setCronMessage({
        type: 'error',
        text: '切换失败: ' + (err instanceof Error ? err.message : String(err)),
      });
      setTimeout(() => setCronMessage(null), 3000);
    } finally {
      setCronToggling(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 定时任务开关 */}
      <Card>
        <CardHeader>
          <CardTitle>定时任务设置</CardTitle>
          <CardDescription>启用或禁用自动执行的定时任务</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cron-enabled" className="text-base font-medium">
                定时任务
              </Label>
              <p className="text-sm text-muted-foreground">
                {cronEnabled === null
                  ? '定时任务功能不可用（可能是手动模式）'
                  : cronEnabled
                    ? '定时任务已启用，将按配置的时间自动执行'
                    : '定时任务已禁用，不会自动执行'}
              </p>
            </div>
            <Switch
              id="cron-enabled"
              checked={cronEnabled ?? false}
              onCheckedChange={handleCronToggle}
              disabled={cronToggling || cronEnabled === null}
            />
          </div>

          {cronMessage && (
            <Alert
              className={
                cronMessage.type === 'success'
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }
            >
              <AlertDescription
                className={cronMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}
              >
                {cronMessage.text}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 手动触发任务 */}
      <Card>
        <CardHeader>
          <CardTitle>手动触发任务</CardTitle>
          <CardDescription>点击下方按钮手动触发一次文件整理任务。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="dryRun"
              checked={dryRun}
              onCheckedChange={(checked) => setDryRun(checked === true)}
              disabled={loading}
            />
            <Label
              htmlFor="dryRun"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              模拟运行（Dry Run）- 不实际移动文件，仅查看分类效果
            </Label>
          </div>

          <Button
            onClick={handleTrigger}
            disabled={loading}
            className="w-full sm:w-auto"
            variant={dryRun ? 'outline' : 'default'}
          >
            {loading ? '执行中...' : dryRun ? '模拟执行' : '执行任务'}
          </Button>

          {result && (
            <div className="mt-4">
              {loading && result.message === '任务执行中，请稍候...' ? (
                <Alert>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              ) : result.success ? (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">{result.message}</AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    {result.message}
                    {result.error ? `: ${result.error}` : ''}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TriggerView;
