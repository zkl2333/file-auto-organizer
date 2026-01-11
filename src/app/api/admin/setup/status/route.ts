import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import type { AdminSetupStatus } from '@/types/auth';

export async function GET() {
  try {
    const config = getConfig();

    // 检查管理员是否已设置（用户名和密码都不为空）
    const isUsernameSet = Boolean(
      config.auth.admin_username && config.auth.admin_username.length > 0
    );
    const isPasswordSet = Boolean(
      config.auth.admin_password && config.auth.admin_password.length > 0
    );

    const initialized = isUsernameSet && isPasswordSet;

    const status: AdminSetupStatus = {
      initialized,
      needsSetup: !initialized,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to check admin setup status:', error);
    return NextResponse.json({ error: 'Failed to check setup status' }, { status: 500 });
  }
}
