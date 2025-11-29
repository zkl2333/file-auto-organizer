import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configure external packages for server-side only
  serverExternalPackages: ['exiftool-vendored'],

  // Configure API route rewrites
  async rewrites() {
    return [
      {
        source: '/api/files/:path*',
        destination: '/api/files',
      },
    ];
  },

  // Configure Turbopack
  turbopack: {},

  // Configure Webpack with Turbopack compatibility
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Don't bundle server-side modules on client
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
