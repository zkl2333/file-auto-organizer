import { StatsView } from '@/components/StatsView';

interface PageProps {
  params: Promise<{
    timeRange: 'today' | 'week' | 'month' | 'all';
  }>;
}

export default async function StatsTimeRangePage({ params }: PageProps) {
  const { timeRange } = await params;

  return <StatsView timeRange={timeRange} />;
}
