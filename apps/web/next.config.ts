import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mimic/core', '@mimic/ui'],
  experimental: { typedRoutes: true }
};

export default nextConfig;
