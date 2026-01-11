import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import type { JWTPayload as CustomJWTPayload } from '@/types/auth';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined');
}

if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is not defined');
}

const accessTokenSecret = new TextEncoder().encode(JWT_SECRET);
const refreshTokenSecret = new TextEncoder().encode(JWT_REFRESH_SECRET);

/**
 * 生成 Access Token
 */
export async function generateAccessToken(
  userId: string,
  username: string,
  rememberMe: boolean = false
): Promise<string> {
  const expiryTime = rememberMe ? '30d' : '24h';

  return await new SignJWT({
    sub: userId,
    username,
    type: 'access',
    rememberMe,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiryTime)
    .sign(accessTokenSecret);
}

/**
 * 生成 Refresh Token
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
    .sign(refreshTokenSecret);
}

/**
 * 验证 Access Token
 */
export async function verifyAccessToken(token: string): Promise<CustomJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessTokenSecret);
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
    const { payload } = await jwtVerify(token, refreshTokenSecret);
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
 */
export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  // 在生产环境中，密码应该是 bcrypt hash
  // 这里为了简化开发，直接比较明文密码
  // TODO: 在生产环境中使用 bcrypt.compare()
  if (username !== adminUsername) {
    logger.warn({ username }, 'Invalid admin username');
    return false;
  }

  if (password !== adminPassword) {
    logger.warn({ username }, 'Invalid admin password');
    return false;
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
