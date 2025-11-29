'use client';

import { useEffect, useState } from 'react';
import { statsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { SectionCards } from '@/components/section-cards';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';

export default function StatsPage() {
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const response = await statsApi.getDashboardStats();
        if (response.success) {
          setStatsData(response.data);
        } else {
          setError(response.error || 'Failed to load statistics');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!statsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">No data available</div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard
          title="Total Files"
          value={statsData.totalFiles?.toString() || '0'}
          description="Files in root directory"
        />
        <StatCard
          title="Processed"
          value={statsData.processedFiles?.toString() || '0'}
          description="Successfully processed"
        />
        <StatCard
          title="Pending"
          value={statsData.pendingFiles?.toString() || '0'}
          description="Waiting for processing"
        />
        <StatCard
          title="Errors"
          value={statsData.errorFiles?.toString() || '0'}
          description="Processing errors"
        />
      </div>

      {/* Charts and Sections */}
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCards className="xl:col-span-2" categories={statsData.categories || {}} />
        <ChartAreaInteractive />
      </div>
    </div>
  );
}
