import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createInitialUser } from "@/lib/data";
import { setAuthCookie, signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createInitialUser({
      username: String(username).trim(),
      passwordHash,
    });

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
    if (
      error instanceof Error &&
      error.message === "SETUP_ALREADY_COMPLETE"
    ) {
      return NextResponse.json(
        { error: "Setup has already been completed." },
        { status: 409 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "That username is already in use." },
        { status: 409 }
      );
    }

    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
