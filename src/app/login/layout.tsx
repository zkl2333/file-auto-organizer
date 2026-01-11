import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { initializeLogging } from '@/lib/log-init';
import '../globals.css';

// 初始化日志系统
if (typeof window === 'undefined') {
  initializeLogging();
}

export const metadata: Metadata = {
  title: '登录 - File Auto Organizer',
  description: '登录以访问文件自动整理系统',
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
