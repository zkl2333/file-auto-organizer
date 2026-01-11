export interface JWTPayload {
  sub: string;
  username: string;
  type: 'access' | 'refresh';
  rememberMe: boolean;
  iat: number;
  exp: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    username: string;
  };
}
