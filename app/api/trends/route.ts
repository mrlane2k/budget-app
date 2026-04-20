import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getMonthlyTrends } from "@/lib/data";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedMonths = Number(searchParams.get("months") ?? "6");
  const months =
    Number.isFinite(requestedMonths) && (requestedMonths === 6 || requestedMonths === 12)
      ? requestedMonths
      : 6;

  try {
    const trends = await getMonthlyTrends(userPayload.userId, months);
    return NextResponse.json({ months, ...trends });
  } catch (error) {
    console.error("Get trends error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
