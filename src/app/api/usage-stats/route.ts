import { NextRequest, NextResponse } from 'next/server';
import { StatsService } from '@/lib/services/stats.service';
import { verifyAuth } from '@/lib/auth';

// GET /api/usage-stats
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || 'all') as 'today' | 'week' | 'month' | 'all';
    const includeDryRun = searchParams.get('includeDryRun') === 'true';

    const statsService = new StatsService();
    const stats = statsService.getStats(range, includeDryRun);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取使用统计失败:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
