'use client';

import { type Icon } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { ViewType } from './app-sidebar';

export function NavMain({
  items,
}: {
  items: {
    id: ViewType;
    title: string;
    icon?: Icon;
  }[];
}) {
  const pathname = usePathname();

  const isActive = (itemId: string) => {
    const itemPath = `/${itemId}`;
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                tooltip={item.title}
                isActive={isActive(item.id)}
                asChild
              >
                <Link href={`/${item.id}`}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
