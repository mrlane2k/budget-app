import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { updateMonthlyBudget } from "@/lib/data";

function parsePositiveMoney(value: unknown): number | null {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/monthly-budgets/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const budgetId = Number(id);
  if (!Number.isFinite(budgetId)) {
    return NextResponse.json({ error: "Invalid budget id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const billsBudget = parsePositiveMoney(body.bills_budget);
    const disposableBudget = parsePositiveMoney(body.disposable_budget);
    const savingsTarget = parsePositiveMoney(body.savings_target);
    const extraDebtPaymentTarget = parsePositiveMoney(body.extra_debt_payment_target);

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

    const budget = await updateMonthlyBudget(userPayload.userId, budgetId, {
      bills_budget: billsBudget,
      disposable_budget: disposableBudget,
      savings_target: savingsTarget,
      extra_debt_payment_target: extraDebtPaymentTarget,
    });

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json(budget);
  } catch (error) {
    console.error("Update monthly budget error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
