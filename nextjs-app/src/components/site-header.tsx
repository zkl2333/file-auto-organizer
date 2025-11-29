import { useLocation } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import type { ViewType } from './app-sidebar';

const viewTitles: Record<ViewType, string> = {
  stats: '统计信息',
  'task-history': '任务历史',
  logs: '日志查看',
  trigger: '手动触发',
  config: '配置管理',
};

export function SiteHeader() {
  const location = useLocation();
  const currentView = location.pathname.slice(1) || ('stats' as ViewType);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">
          {viewTitles[currentView as ViewType] || viewTitles.stats}
        </h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
