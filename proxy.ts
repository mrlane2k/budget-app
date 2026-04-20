import { NextRequest, NextResponse } from "next/server";
import { stripBasePath, withBasePath } from "@/lib/basepath";

export function proxy(request: NextRequest) {
  const requestPath = stripBasePath(request.nextUrl.pathname);
  const isPublicPath =
    requestPath === "/login" ||
    requestPath === "/setup" ||
    requestPath.startsWith("/api/auth") ||
    requestPath.startsWith("/api/setup") ||
    requestPath.startsWith("/_next") ||
    requestPath.startsWith("/favicon");

  if (isPublicPath) {
    return NextResponse.next();
  }

  const hasToken = Boolean(request.cookies.get("auth_token")?.value);
  if (!hasToken) {
    const loginUrl = new URL(withBasePath("/login"), request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
