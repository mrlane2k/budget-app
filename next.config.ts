import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  assetPrefix: '/budget',
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
