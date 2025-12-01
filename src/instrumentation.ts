/**
 * Next.js Instrumentation
 * 这个文件会在服务器启动时执行一次，是初始化服务端逻辑的正确位置
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 只在 Node.js 运行时初始化（排除 Edge Runtime）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeLogging } = await import('@/lib/log-init');
    initializeLogging();
  }
}
