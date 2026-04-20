import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserByUsername, isSetupRequired } from "@/lib/data";
import { setAuthCookie, signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (await isSetupRequired()) {
      return NextResponse.json(
        { error: "Setup is required before logging in." },
        { status: 409 }
      );
    }

    const user = await getAuthUserByUsername(String(username).trim());

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signToken({ userId: user.id, username: user.username });

    const response = NextResponse.json({
      success: true,
      username: user.username,
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
