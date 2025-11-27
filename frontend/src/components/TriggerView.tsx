import React, { useState } from 'react';
import { api } from '../api';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const TriggerView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; error?: string } | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    setResult({ success: true, message: '任务执行中，请稍候...' });
    
    try {
      const res = await api.triggerTask(dryRun);
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        message: '请求失败',
        error: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
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
          variant={dryRun ? "outline" : "default"}
        >
          {loading ? '执行中...' : (dryRun ? '模拟执行' : '执行任务')}
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
                  {result.message}{result.error ? `: ${result.error}` : ''}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

