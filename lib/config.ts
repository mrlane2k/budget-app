function normalizeBasePath(value?: string | null): string {
  if (!value || value === "/") {
    return "";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

function parseBoolean(value?: string | null): boolean | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parsePort(value?: string | null): number {
  const parsed = Number(value ?? "3004");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3004;
}

const isProduction = process.env.NODE_ENV === "production";

export const runtimeConfig = {
  isProduction,
  appBasePath: normalizeBasePath(
    process.env.NEXT_PUBLIC_APP_BASE_PATH ?? process.env.APP_BASE_PATH
  ),
  appOrigin: process.env.APP_ORIGIN ?? "",
  port: parsePort(process.env.PORT),
  cookieSecure: parseBoolean(process.env.COOKIE_SECURE) ?? isProduction,
};
