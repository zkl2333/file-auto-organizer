'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { IconHome } from '@tabler/icons-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { ViewType } from '@/components/app-sidebar';

const viewTitles: Record<ViewType, string> = {
  stats: '统计信息',
  'task-history': '任务历史',
  logs: '日志查看',
  trigger: '手动触发',
  config: '配置管理',
};

// 时间范围的中文映射
const timeRangeMap: Record<string, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  all: '全部',
};

interface BreadcrumbSegment {
  title: string;
  href?: string;
}

function getBreadcrumbSegments(pathname: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];

  // 解析路径
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 0) {
    // 首页
    return [{ title: '首页' }];
  }

  // 第一级路由
  const firstPart = parts[0] as ViewType;
  if (viewTitles[firstPart]) {
    segments.push({
      title: viewTitles[firstPart],
      href: `/${firstPart}`,
    });

    // 处理子路由
    if (parts.length > 1) {
      const secondPart = parts[1];

      if (firstPart === 'stats') {
        // 统计信息的时间范围
        const timeRangeTitle = timeRangeMap[secondPart] || secondPart;
        segments.push({
          title: timeRangeTitle,
        });
      } else if (firstPart === 'task-history') {
        // 任务历史的详情页
        segments.push({
          title: '任务详情',
        });
      }
    }
  } else {
    // 未知路由，显示首页
    segments.push({ title: '首页', href: '/' });
  }

  return segments;
}

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = getBreadcrumbSegments(pathname);

  // 如果只有一个段且是首页，不显示面包屑
  if (segments.length === 1 && segments[0].title === '首页' && !segments[0].href) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* 首页链接 */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" className="flex items-center gap-1.5">
              <IconHome className="size-3.5" />
              <span>首页</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <div key={index} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={segment.href || '#'}>{segment.title}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
