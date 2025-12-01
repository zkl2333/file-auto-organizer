import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configure external packages for server-side only
  serverExternalPackages: ['exiftool-vendored', 'pino', 'rotating-file-stream'],

  // Configure page extensions
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],

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
};

export default nextConfig;
