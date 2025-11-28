import { useParams } from 'react-router-dom';
import { StatsView } from '@/components/StatsView';

type TimeRange = 'today' | 'week' | 'month' | 'all';

export default function StatsWithTimeRange() {
  const { timeRange } = useParams<{ timeRange: TimeRange }>();

  return <StatsView timeRange={timeRange || 'week'} />;
}
