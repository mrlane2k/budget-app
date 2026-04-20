import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createMonthlyBudget, listMonthlyBudgets } from "@/lib/data";

function parsePositiveMoney(value: unknown): number | null {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

function parseBudgetPeriod(value: string | null, minimum: number, maximum: number): number | null {
  if (!value) {
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

  const year = parseBudgetPeriod(request.nextUrl.searchParams.get("year"), 2000, 2100);
  const month = parseBudgetPeriod(request.nextUrl.searchParams.get("month"), 1, 12);
  const months = parseBudgetPeriod(request.nextUrl.searchParams.get("months"), 1, 24);

  if (
    request.nextUrl.searchParams.has("year") &&
    request.nextUrl.searchParams.get("year") !== null &&
    year === null
  ) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  if (
    request.nextUrl.searchParams.has("month") &&
    request.nextUrl.searchParams.get("month") !== null &&
    month === null
  ) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  if (
    request.nextUrl.searchParams.has("months") &&
    request.nextUrl.searchParams.get("months") !== null &&
    months === null
  ) {
    return NextResponse.json({ error: "Invalid months value" }, { status: 400 });
  }

  if ((year === null) !== (month === null)) {
    return NextResponse.json(
      { error: "Year and month must be provided together" },
      { status: 400 }
    );
  }

  try {
    const budgets = await listMonthlyBudgets(userPayload.userId, {
      year: year ?? undefined,
      month: month ?? undefined,
      months: months ?? undefined,
    });

    return NextResponse.json(budgets);
  } catch (error) {
    console.error("List monthly budgets error:", error);
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
    const year = parseBudgetPeriod(String(body.year ?? ""), 2000, 2100);
    const month = parseBudgetPeriod(String(body.month ?? ""), 1, 12);
    const billsBudget = parsePositiveMoney(body.bills_budget);
    const disposableBudget = parsePositiveMoney(body.disposable_budget);
    const savingsTarget = parsePositiveMoney(body.savings_target);
    const extraDebtPaymentTarget = parsePositiveMoney(body.extra_debt_payment_target);

    if (year === null) {
      return NextResponse.json({ error: "Valid year is required" }, { status: 400 });
    }

    if (month === null) {
      return NextResponse.json({ error: "Valid month is required" }, { status: 400 });
    }

    if (billsBudget === null) {
      return NextResponse.json(
        { error: "Bills budget must be a valid non-negative number" },
        { status: 400 }
      );
    }

    if (disposableBudget === null) {
      return NextResponse.json(
        { error: "Disposable budget must be a valid non-negative number" },
        { status: 400 }
      );
    }

    if (savingsTarget === null) {
      return NextResponse.json(
        { error: "Savings target must be a valid non-negative number" },
        { status: 400 }
      );
    }

    if (extraDebtPaymentTarget === null) {
      return NextResponse.json(
        { error: "Extra debt payment target must be a valid non-negative number" },
        { status: 400 }
      );
    }

    const budget = await createMonthlyBudget(userPayload.userId, {
      year,
      month,
      bills_budget: billsBudget,
      disposable_budget: disposableBudget,
      savings_target: savingsTarget,
      extra_debt_payment_target: extraDebtPaymentTarget,
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "A budget for that month already exists" },
        { status: 409 }
      );
    }

    console.error("Create monthly budget error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
