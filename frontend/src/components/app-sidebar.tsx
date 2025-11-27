import * as React from "react"
import { Link } from "react-router-dom"
import {
  IconChartBar,
  IconFileText,
  IconFolder,
  IconPlayerPlay,
  IconSettings,
  IconFiles,
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

export type ViewType = 'stats' | 'logs' | 'trigger' | 'config' | 'files'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {}

export function AppSidebar({ ...props }: AppSidebarProps) {
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
      id: 'files' as ViewType,
      title: "文件导航",
      icon: IconFiles,
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
              <Link to="/">
                <IconFolder className="size-5!" />
                <span className="text-base font-semibold">文件自动整理</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
    </Sidebar>
  )
}
