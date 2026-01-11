import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRefreshToken, generateAccessToken } from '@/lib/auth';

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: '未找到刷新令牌' }, { status: 401 });
    }

    // 验证 Refresh Token
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      cookieStore.delete('refreshToken');
      return NextResponse.json({ error: '无效的刷新令牌' }, { status: 401 });
    }

    // 生成新的 Access Token
    const newAccessToken = await generateAccessToken(
      payload.sub,
      payload.username,
      payload.rememberMe
    );

    return NextResponse.json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json({ error: '刷新令牌失败' }, { status: 500 });
  }
}
