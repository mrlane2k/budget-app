import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getUserProfileById } from "@/lib/data";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserProfileById(userPayload.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}
