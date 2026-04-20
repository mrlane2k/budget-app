import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getCalendarMonth } from "@/lib/data";

function parsePeriodValue(
  value: string | null,
  minimum: number,
  maximum: number
): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedYear = request.nextUrl.searchParams.get("year");
  const requestedMonth = request.nextUrl.searchParams.get("month");

  const year = parsePeriodValue(requestedYear, 2000, 2100);
  const month = parsePeriodValue(requestedMonth, 1, 12);

  if ((requestedYear === null) !== (requestedMonth === null)) {
    return NextResponse.json(
      { error: "Year and month must be provided together" },
      { status: 400 }
    );
  }

  if (requestedYear !== null && year === null) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  if (requestedMonth !== null && month === null) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth() + 1;

  try {
    const payload = await getCalendarMonth(
      userPayload.userId,
      targetYear,
      targetMonth
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Get calendar month error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
