import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 配置外部包，特别是 exiftool-vendored 需要在服务端运行
  experimental: {
    serverComponentsExternalPackages: ['exiftool-vendored'],
  },

  // 配置 API 路由重写
  async rewrites() {
    return [
      {
        source: '/api/files/:path*',
        destination: '/api/files',
      }
    ]
  },

  // 配置 WebSocket 支持（如果需要实时通信）
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 客户端不打包服务端专用模块
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;
