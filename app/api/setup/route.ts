import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie, signToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/server/http";
import { createInitialUserAccount } from "@/lib/server/user-service";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const user = await createInitialUserAccount({ username, password });

    const token = signToken({
      userId: user.id,
      username: user.username,
    });

    const response = NextResponse.json({
      success: true,
      user,
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    return handleRouteError(error, "Setup error:");
  }
}
