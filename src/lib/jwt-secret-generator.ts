import { randomBytes } from 'node:crypto';
import { logger } from './logger';

/**
 * 生成加密安全的 JWT secret
 * 使用 crypto.randomBytes 生成 32 字节（256 位）随机数据
 * 转换为 64 字符的 hex 字符串
 */
export function generateJwtSecret(): string {
  const secret = randomBytes(32).toString('hex');
  logger.debug('Generated new JWT secret');
  return secret;
}

/**
 * 验证 JWT secret 的强度
 */
export function validateJwtSecret(secret: string): { valid: boolean; error?: string } {
  if (!secret || secret.length === 0) {
    return { valid: false, error: 'JWT secret cannot be empty' };
  }

  if (secret.length < 32) {
    return { valid: false, error: 'JWT secret must be at least 32 characters' };
  }

  // 检查是否使用了明显的默认值
  const weakSecrets = ['secret', 'password', 'test', 'admin', 'jwt_secret', 'default', 'demo'];

  if (weakSecrets.some((weak) => secret.toLowerCase().includes(weak))) {
    return { valid: false, error: 'JWT secret must not use weak/default values' };
  }

  return { valid: true };
}
