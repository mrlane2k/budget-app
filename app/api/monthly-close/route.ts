import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getMonthlyClose, upsertMonthlyClose } from "@/lib/data";

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

function parseBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
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
    const close = await getMonthlyClose(
      userPayload.userId,
      targetYear,
      targetMonth
    );
    return NextResponse.json(close);
  } catch (error) {
    console.error("Get monthly close error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const year = parsePeriodValue(String(body.year ?? ""), 2000, 2100);
    const month = parsePeriodValue(String(body.month ?? ""), 1, 12);
    const billsReviewed = parseBooleanValue(body.bills_reviewed);
    const transfersReviewed = parseBooleanValue(body.transfers_reviewed);
    const disposableReviewed = parseBooleanValue(body.disposable_reviewed);
    const creditCardsReviewed = parseBooleanValue(body.credit_cards_reviewed);
    const closedValue =
      body.closed === undefined ? false : parseBooleanValue(body.closed);

    if (year === null) {
      return NextResponse.json({ error: "Valid year is required" }, { status: 400 });
    }

    if (month === null) {
      return NextResponse.json({ error: "Valid month is required" }, { status: 400 });
    }

    if (billsReviewed === null) {
      return NextResponse.json(
        { error: "Bills reviewed must be true or false" },
        { status: 400 }
      );
    }

    if (transfersReviewed === null) {
      return NextResponse.json(
        { error: "Transfers reviewed must be true or false" },
        { status: 400 }
      );
    }

    if (disposableReviewed === null) {
      return NextResponse.json(
        { error: "Disposable reviewed must be true or false" },
        { status: 400 }
      );
    }

    if (creditCardsReviewed === null) {
      return NextResponse.json(
        { error: "Credit cards reviewed must be true or false" },
        { status: 400 }
      );
    }

    if (closedValue === null) {
      return NextResponse.json(
        { error: "Closed must be true or false" },
        { status: 400 }
      );
    }

    const close = await upsertMonthlyClose(userPayload.userId, {
      year,
      month,
      bills_reviewed: billsReviewed,
      transfers_reviewed: transfersReviewed,
      disposable_reviewed: disposableReviewed,
      credit_cards_reviewed: creditCardsReviewed,
      notes: typeof body.notes === "string" ? body.notes : null,
      closed: closedValue,
    });

    return NextResponse.json(close);
  } catch (error) {
    if (error instanceof Error && error.message === "MONTH_CLOSE_INCOMPLETE") {
      return NextResponse.json(
        { error: "Complete every review item before closing the month" },
        { status: 400 }
      );
    }

    console.error("Save monthly close error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
