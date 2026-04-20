import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getBudgetVsActual } from "@/lib/data";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedMonths = Number(request.nextUrl.searchParams.get("months") ?? "6");
  const months =
    Number.isFinite(requestedMonths) && (requestedMonths === 6 || requestedMonths === 12)
      ? requestedMonths
      : 6;

  try {
    const payload = await getBudgetVsActual(userPayload.userId, months);
    return NextResponse.json({ months, ...payload });
  } catch (error) {
    console.error("Get budget vs actual error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
