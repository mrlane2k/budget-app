import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie, signToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/server/http";
import { authenticateUser } from "@/lib/server/user-service";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const user = await authenticateUser({ username, password });

    const token = signToken({ userId: user.userId, username: user.username });

    const response = NextResponse.json({
      success: true,
      username: user.username,
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    return handleRouteError(error, "Login error:");
  }
}
