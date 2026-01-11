import { NextRequest, NextResponse } from 'next/server';
import { readLogFiles } from '@/lib/services/log.service';
import { verifyAuth } from '@/lib/auth';

// GET /api/logs
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200');

    const logs = await readLogFiles(limit);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('获取日志失败:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
