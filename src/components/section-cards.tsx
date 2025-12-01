'use client';

import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface SectionCardsProps {
  className?: string;
  categories?: Record<string, any>;
}

export function SectionCards({ className, categories = {} }: SectionCardsProps) {
  // 将 categories 对象转换为数组以便渲染
  const categoryEntries = Object.entries(categories).map(([key, value]) => ({
    name: key,
    count: typeof value === 'number' ? value : (value as any).count || 0,
    trend: typeof value === 'object' ? (value as any).trend || 0 : 0,
  }));

  // 如果没有 categories 数据，显示默认的占位内容
  if (Object.keys(categories).length === 0) {
    return (
      <div
        className={`*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 ${className}`}
      >
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>文件分类</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              数据加载中...
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">等待统计数据</div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>分类概览</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              正在获取
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">文件组织统计</div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 ${className}`}
    >
      {categoryEntries.slice(0, 4).map((category) => (
        <Card key={category.name} className="@container/card">
          <CardHeader>
            <CardDescription>分类类别</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {category.count}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {category.trend >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
                {Math.abs(category.trend)}%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {category.trend >= 0 ? '增长趋势' : '下降趋势'} <IconTrendingUp className="size-4" />
            </div>
            <div className="text-muted-foreground">{category.name} 分类文件</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
