import { type Icon } from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { ViewType } from "./app-sidebar";

export function NavMain({
  items,
}: {
  items: {
    id: ViewType;
    title: string;
    icon?: Icon;
  }[];
}) {
  const location = useLocation();

  const isActive = (itemId: string) => {
    const itemPath = `/${itemId}`;
    return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
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
                <Link to={`/${item.id}`}>
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
