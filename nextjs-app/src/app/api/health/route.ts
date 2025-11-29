import { NextRequest, NextResponse } from 'next/server';

/**
 * e∑¿Â API
 * GET /api/health
 */
export async function GET(request: NextRequest) {
  try {
    // ¿Â˚ﬂe∑∂
    const healthCheck = {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };

    return NextResponse.json({
      success: true,
      data: healthCheck,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        data: {
          status: 'unhealthy' as const,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}