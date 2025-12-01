'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'dots' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  centered?: boolean;
}

export function LoadingState({
  type = 'spinner',
  size = 'md',
  text,
  className,
  centered = true,
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const containerClasses = cn(centered && 'flex items-center justify-center', className);

  const renderLoadingIcon = () => {
    switch (type) {
      case 'spinner':
        return <Loader2 className={cn('animate-spin', sizeClasses[size])} />;
      case 'dots':
        return <DotsLoader size={size} />;
      case 'pulse':
        return <PulseLoader size={size} />;
      case 'skeleton':
        return <SkeletonLoader />;
      default:
        return <Loader2 className={cn('animate-spin', sizeClasses[size])} />;
    }
  };

  if (type === 'skeleton') {
    return <SkeletonLoader />;
  }

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-3">
        {renderLoadingIcon()}
        {text && <p className={cn('text-muted-foreground', textSizeClasses[size])}>{text}</p>}
      </div>
    </div>
  );
}

// 点状加载器
function DotsLoader({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const dotSize = {
    sm: 'h-1 w-1',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  }[size];

  return (
    <div className="flex space-x-1">
      <div className={cn('bg-primary rounded-full animate-bounce', dotSize)} />
      <div
        className={cn('bg-primary rounded-full animate-bounce', dotSize)}
        style={{ animationDelay: '0.1s' }}
      />
      <div
        className={cn('bg-primary rounded-full animate-bounce', dotSize)}
        style={{ animationDelay: '0.2s' }}
      />
    </div>
  );
}

// 脉冲加载器
function PulseLoader({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }[size];

  return <div className={cn('bg-primary rounded-full animate-pulse', sizeClasses)} />;
}

// 骨架屏加载器
function SkeletonLoader() {
  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

// 页面级加载状态
export function PageLoading({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <LoadingState type="spinner" size="lg" text={text} />
    </div>
  );
}

// 表格行加载状态
export function TableLoading({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="p-4">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// 刷新按钮加载状态
export function RefreshLoading({
  isLoading,
  onClick,
  size = 'sm',
}: {
  isLoading: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
    >
      <RefreshCw className={cn(sizeClasses[size], isLoading && 'animate-spin')} />
      <span className="sr-only">刷新</span>
    </button>
  );
}
