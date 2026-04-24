import { runtimeConfig } from "@/lib/config";

export const BASE_PATH = runtimeConfig.appBasePath;

export function stripBasePath(pathname: string): string {
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    const stripped = pathname.slice(BASE_PATH.length);
    return stripped || "/";
  }

  return pathname || "/";
}
