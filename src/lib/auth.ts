import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { getConfig } from './config';
import type { JWTPayload as CustomJWTPayload } from '@/types/auth';

/**
 * 获取 JWT 密钥
 */
function getAccessTokenSecret(): Uint8Array {
  const secret = getConfig().auth.jwt_secret;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in config.yaml');
  }
  return new TextEncoder().encode(secret);
}

/**
 * 获取 Refresh Token 密钥
 */
function getRefreshTokenSecret(): Uint8Array {
  const secret = getConfig().auth.jwt_refresh_secret;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not configured in config.yaml');
  }
  return new TextEncoder().encode(secret);
}

/**
 * 生成 Access Token
 * 安全优化：缩短有效期以减少被盗风险
 * - 记住我: 7天 (用户可以在 Refresh Token 有效期内自动刷新)
 * - 不记住我: 1小时 (更安全，公共设备)
 */
export async function generateAccessToken(
  userId: string,
  username: string,
  rememberMe: boolean = false
): Promise<string> {
  const expiryTime = rememberMe ? '7d' : '1h';

  return await new SignJWT({
    sub: userId,
    username,
    type: 'access',
    rememberMe,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiryTime)
    .sign(getAccessTokenSecret());
}

/**
 * 生成 Refresh Token
 * 较长有效期用于自动续期，但通过 HttpOnly Cookie 存储
 * - 记住我: 90天
 * - 不记住我: 7天
 */
export async function generateRefreshToken(
  userId: string,
  username: string,
  rememberMe: boolean = false
): Promise<string> {
  const expiryTime = rememberMe ? '90d' : '7d';

  return await new SignJWT({
    sub: userId,
    username,
    type: 'refresh',
    rememberMe,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiryTime)
    .sign(getRefreshTokenSecret());
}

/**
 * 验证 Access Token
 */
export async function verifyAccessToken(token: string): Promise<CustomJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessTokenSecret());
    if (payload.type !== 'access') {
      return null;
    }
    return payload as unknown as CustomJWTPayload;
  } catch (error) {
    logger.warn({ error }, 'Access token verification failed');
    return null;
  }
}

/**
 * 验证 Refresh Token
 */
export async function verifyRefreshToken(token: string): Promise<CustomJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshTokenSecret());
    if (payload.type !== 'refresh') {
      return null;
    }
    return payload as unknown as CustomJWTPayload;
  } catch (error) {
    logger.warn({ error }, 'Refresh token verification failed');
    return null;
  }
}

/**
 * 验证管理员凭证
 * 支持明文密码（用于向后兼容）和 bcrypt 哈希密码
 */
export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const config = getConfig();
  const adminUsername = config.auth.admin_username;
  const adminPassword = config.auth.admin_password;

  // 检查管理员是否已设置（用户名和密码都不为空）
  if (
    !adminUsername ||
    adminUsername.length === 0 ||
    !adminPassword ||
    adminPassword.length === 0
  ) {
    logger.warn('Admin credentials not configured');
    return false;
  }

  // 验证用户名
  if (username !== adminUsername) {
    logger.warn({ username }, 'Invalid admin username');
    return false;
  }

  // 检查密码是否为 bcrypt 哈希（bcrypt 哈希以 $2b$ 或 $2a$ 开头）
  const isBcryptHash = adminPassword.startsWith('$2');

  if (isBcryptHash) {
    // 使用 bcrypt 比较哈希密码
    const isValid = await verifyPassword(password, adminPassword);
    if (!isValid) {
      logger.warn({ username }, 'Invalid admin password (bcrypt)');
      return false;
    }
  } else {
    // 向后兼容：直接比较明文密码
    // 注意：这是一个临时解决方案，用户应该使用 setup 页面更新为 bcrypt 哈希
    if (password !== adminPassword) {
      logger.warn({ username }, 'Invalid admin password (plain text)');
      return false;
    }
  }

  logger.info({ username }, 'Admin credentials verified');
  return true;
}

/**
 * 哈希密码（用于将来升级到 bcrypt）
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * 验证密码（用于将来升级到 bcrypt）
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * 从 Authorization header 提取 Bearer Token
 */
export function extractAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * 验证请求的认证状态
 * 返回 { user: CustomJWTPayload } 或返回 NextResponse 错误响应
 */
export async function verifyAuth(
  request: NextRequest
): Promise<{ user: CustomJWTPayload } | NextResponse> {
  const token = extractAuthToken(request);

  if (!token) {
    return NextResponse.json({ error: '未提供认证令牌' }, { status: 401 });
  }

  const payload = await verifyAccessToken(token);

  if (!payload) {
    return NextResponse.json({ error: '认证令牌无效或已过期' }, { status: 401 });
  }

  return { user: payload };
}

/**
 * 认证中间件包装器 - 保护 API 路由
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const auth = await verifyAuth(request);
 *   if (auth instanceof NextResponse) return auth;
 *
 *   const { user } = auth;
 *   // 继续处理请求...
 * }
 */
