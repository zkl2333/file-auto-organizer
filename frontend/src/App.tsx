import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { StatsView } from './components/StatsView';
import { LogsView } from './components/LogsView';
import { TriggerView } from './components/TriggerView';
import { ConfigView } from './components/ConfigView';

function App() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
              <Routes>
                <Route path="/" element={<Navigate to="/stats" replace />} />
                <Route path="/stats" element={<StatsView />} />
                <Route path="/logs" element={<LogsView />} />
                <Route path="/trigger" element={<TriggerView />} />
                <Route path="/config" element={<ConfigView />} />
              </Routes>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
