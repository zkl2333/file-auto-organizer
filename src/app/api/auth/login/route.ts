import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAccessToken, generateRefreshToken, verifyAdminCredentials } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import type { AuthResponse } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, rememberMe = false } = body;

    // 验证输入
    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    // 检查管理员是否已初始化
    const config = getConfig();
    const isInitialized =
      config.auth.admin_username &&
      config.auth.admin_username.length > 0 &&
      config.auth.admin_password &&
      config.auth.admin_password.length > 0;

    if (!isInitialized) {
      return NextResponse.json(
        { error: '管理员未初始化，请先访问 /admin/setup 设置管理员账户', needsSetup: true },
        { status: 403 }
      );
    }

    // 验证管理员凭证
    const isValid = await verifyAdminCredentials(username, password);
    if (!isValid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 生成 Token
    const userId = `admin-${username}`;
    const accessToken = await generateAccessToken(userId, username, rememberMe);
    const refreshToken = await generateRefreshToken(userId, username, rememberMe);

    // 设置 Refresh Token 为 HttpOnly Cookie
    const cookieStore = await cookies();
    const refreshTokenExpiry = rememberMe ? 90 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: refreshTokenExpiry,
    });

    // 返回 Access Token 和用户信息
    const response: AuthResponse = {
      accessToken,
      refreshToken,
      user: {
        username,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 });
  }
}
