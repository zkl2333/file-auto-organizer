import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig, saveConfig } from '@/lib/config';
import { hashPassword } from '@/lib/auth';
import type { AdminSetupRequest } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body as AdminSetupRequest;

    // 验证输入
    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: '用户名至少需要 3 个字符' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少需要 6 个字符' }, { status: 400 });
    }

    // 检查管理员是否已初始化
    const config = getConfig();
    const isInitialized =
      config.auth.admin_username &&
      config.auth.admin_username.length > 0 &&
      config.auth.admin_password &&
      config.auth.admin_password.length > 0;

    if (isInitialized) {
      return NextResponse.json({ error: '管理员已初始化，无法重复设置' }, { status: 400 });
    }

    // 哈希密码
    const hashedPassword = await hashPassword(password);

    // 更新管理员凭证
    updateConfig({
      auth: {
        ...config.auth,
        admin_username: username,
        admin_password: hashedPassword,
      },
    });

    // 保存配置到文件
    await saveConfig();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin setup error:', error);
    return NextResponse.json({ error: '管理员设置失败' }, { status: 500 });
  }
}
