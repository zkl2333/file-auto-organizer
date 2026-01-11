import type { JWTPayload } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'access_token';
const USER_KEY = 'user';

export interface AuthUser {
  username: string;
}

/**
 * 认证状态管理 - 客户端
 */
export const authClient = {
  /**
   * 保存访问令牌到 localStorage
   */
  setAccessToken(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  },

  /**
   * 获取访问令牌
   */
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /**
   * 移除访问令牌
   */
  removeAccessToken(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  /**
   * 保存用户信息
   */
  setUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  /**
   * 获取用户信息
   */
  getUser(): AuthUser | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) {
      return null;
    }
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * 移除用户信息
   */
  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  },

  /**
   * 登录 - 保存令牌和用户信息
   */
  login(accessToken: string, user: AuthUser): void {
    this.setAccessToken(accessToken);
    this.setUser(user);
  },

  /**
   * 登出 - 清除所有认证信息
   */
  logout(): void {
    this.removeAccessToken();
    this.removeUser();
  },

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return this.getAccessToken() !== null;
  },

  /**
   * 解析 JWT Payload（不验证签名，仅用于获取信息）
   */
  parseAccessToken(): JWTPayload | null {
    const token = this.getAccessToken();
    if (!token) {
      return null;
    }

    try {
      // JWT 格式: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // 解码 payload
      const payload = parts[1];
      const decoded = atob(payload);
      return JSON.parse(decoded) as JWTPayload;
    } catch {
      return null;
    }
  },

  /**
   * 检查令牌是否即将过期（5分钟内）
   */
  isTokenExpiringSoon(): boolean {
    const payload = this.parseAccessToken();
    if (!payload || !payload.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60;
    return payload.exp - now < fiveMinutes;
  },

  /**
   * 自动刷新 Access Token
   * 当 Access Token 即将过期时调用 refresh API 获取新 Token
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // 确保 HttpOnly Cookie 被发送
      });

      if (!response.ok) {
        console.error('Token refresh failed:', response.status);
        // 如果刷新失败，清除本地认证信息
        this.logout();
        return false;
      }

      const data = await response.json();
      if (data.accessToken) {
        this.setAccessToken(data.accessToken);
        console.log('Access token refreshed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      this.logout();
      return false;
    }
  },

  /**
   * 检查并在必要时刷新 Token
   * @returns 是否成功获取了有效的 Access Token
   */
  async ensureValidToken(): Promise<boolean> {
    // 如果没有 Access Token，直接返回 false
    if (!this.isAuthenticated()) {
      return false;
    }

    // 如果 Token 即将过期，尝试刷新
    if (this.isTokenExpiringSoon()) {
      console.log('Token expiring soon, refreshing...');
      return await this.refreshAccessToken();
    }

    // Token 仍然有效
    return true;
  },
};
