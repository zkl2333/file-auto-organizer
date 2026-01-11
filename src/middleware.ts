import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 需要排除的路径（不需要认证或初始化检查的路径）
const EXCLUDED_PATHS = [
  '/admin/setup',
  '/admin/setup/status',
  '/api/admin/setup',
  '/api/admin/setup/status',
  '/login',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
  '/public',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否在排除路径中
  const isExcluded = EXCLUDED_PATHS.some((path) => pathname.startsWith(path));

  if (isExcluded) {
    return NextResponse.next();
  }

  try {
    // 检查管理员是否已初始化
    const setupCheckResponse = await fetch(new URL('/api/admin/setup/status', request.url), {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (setupCheckResponse.ok) {
      const setupData = await setupCheckResponse.json();

      // 如果未初始化且当前不在 setup 页面，重定向到 setup
      if (setupData.needsSetup && pathname !== '/admin/setup') {
        const setupUrl = new URL('/admin/setup', request.url);
        return NextResponse.redirect(setupUrl);
      }
    }
  } catch (error) {
    // 如果检查失败，允许继续（避免阻塞请求）
    console.error('Middleware setup check failed:', error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - api routes (由 EXCLUDED_PATHS 处理)
     * - _next (Next.js 内部)
     * - static files (images, fonts, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
