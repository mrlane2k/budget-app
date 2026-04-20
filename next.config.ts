import type { NextConfig } from "next";

function normalizeBasePath(value?: string | null): string {
  if (!value || value === "/") {
    return "";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

const basePath = normalizeBasePath(process.env.APP_BASE_PATH);

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: process.cwd(),
  env: {
    NEXT_PUBLIC_APP_BASE_PATH: basePath,
  },
};

export default nextConfig;
