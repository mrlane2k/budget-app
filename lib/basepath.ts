import { runtimeConfig } from "@/lib/config";

export const BASE_PATH = runtimeConfig.appBasePath;

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`Expected an absolute path, received "${path}".`);
  }

  if (!BASE_PATH) {
    return path;
  }

  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}

export function stripBasePath(pathname: string): string {
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    const stripped = pathname.slice(BASE_PATH.length);
    return stripped || "/";
  }

  return pathname || "/";
}

export function apiPath(path: string): string {
  return withBasePath(path);
}
