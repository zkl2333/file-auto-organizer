'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IconEye, IconEyeOff, IconLoader2 } from '@tabler/icons-react';
import type { AdminSetupRequest } from '@/types/auth';

export const AdminSetupView: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);

  // 检查是否已初始化
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch('/api/admin/setup/status');
        if (response.ok) {
          const data = await response.json();
          setIsInitialized(data.initialized);
          if (data.initialized) {
            // 如果已初始化，重定向到登录页
            window.location.href = '/login';
          }
        }
      } catch (err) {
        console.error('Failed to check setup status:', err);
      }
    };

    checkSetupStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证输入
    if (username.length < 3) {
      setError('用户名至少需要 3 个字符');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 个字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const requestData: AdminSetupRequest = { username, password };
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '设置失败');
      }

      // 设置成功，重定向到登录页
      window.location.href = '/login';
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载中或检查状态
  if (isInitialized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <IconLoader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">检查初始化状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">初始化管理员账户</CardTitle>
          <CardDescription>这是首次设置，请创建管理员账户以访问系统</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="设置用户名（至少 3 个字符）"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
                minLength={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="设置密码（至少 6 个字符）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  设置中...
                </>
              ) : (
                '创建管理员账户'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetupView;
