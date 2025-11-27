import React, { useState } from 'react';
import { AppSidebar, type ViewType } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { StatsView } from './components/StatsView';
import { LogsView } from './components/LogsView';
import { TriggerView } from './components/TriggerView';
import { ConfigView } from './components/ConfigView';

function App() {
  const [activeView, setActiveView] = useState<ViewType>('stats');

  const renderContent = () => {
    switch (activeView) {
      case 'stats':
        return <StatsView />;
      case 'logs':
        return <LogsView />;
      case 'trigger':
        return <TriggerView />;
      case 'config':
        return <ConfigView />;
      default:
        return <StatsView />;
    }
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" activeView={activeView} onViewChange={setActiveView} />
      <SidebarInset>
        <SiteHeader activeView={activeView} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
