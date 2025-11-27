import * as React from "react"
import {
  IconChartBar,
  IconFileText,
  IconFolder,
  IconPlayerPlay,
  IconSettings,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type ViewType = 'stats' | 'logs' | 'trigger' | 'config'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
}

export function AppSidebar({ activeView, onViewChange, ...props }: AppSidebarProps) {
  const navItems = [
    {
      id: 'stats' as ViewType,
      title: "统计信息",
      icon: IconChartBar,
    },
    {
      id: 'logs' as ViewType,
      title: "日志查看",
      icon: IconFileText,
    },
    {
      id: 'trigger' as ViewType,
      title: "手动触发",
      icon: IconPlayerPlay,
    },
    {
      id: 'config' as ViewType,
      title: "配置管理",
      icon: IconSettings,
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <IconFolder className="size-5!" />
                <span className="text-base font-semibold">文件自动整理</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} activeView={activeView} onViewChange={onViewChange} />
      </SidebarContent>
    </Sidebar>
  )
}
