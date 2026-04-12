// The app is served at /budget via nginx subpath proxy.
// All client-side fetch() calls need this prefix.
export const BASE_PATH = '/budget';

export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
