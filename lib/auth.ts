import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { getJwtSecret, runtimeConfig } from "@/lib/config";

export interface JwtPayload {
  userId: number;
  username: string;
}

function getCookiePath(): string {
  return runtimeConfig.appBasePath || "/";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function getUser(request: NextRequest): JwtPayload | null {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: runtimeConfig.cookieSecure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: getCookiePath(),
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: runtimeConfig.cookieSecure,
    sameSite: "lax",
    maxAge: 0,
    path: getCookiePath(),
  });
}
