import { AppSidebar } from '@/components/app-sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-2">
            {/* 优化移动端 padding */}
            <div className="@container/main container mx-auto flex flex-col gap-4 px-3 py-3 md:gap-6 md:px-6 md:py-6">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
