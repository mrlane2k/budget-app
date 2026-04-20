import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { deactivateAccount, getAccountById, updateAccount } from "@/lib/data";

const ACCOUNT_TYPES = new Set(["checking", "savings", "credit_card"]);
const ACCOUNT_PURPOSES = new Set(["bills", "disposable", "savings", "credit_card"]);

function parseLastFour(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  return /^[0-9]{4}$/.test(normalized) ? normalized : "invalid";
}

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/accounts/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const accountId = Number(id);
    if (!Number.isFinite(accountId)) {
      return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const accountType = String(body.account_type ?? "");
    const accountPurpose = String(body.account_purpose ?? "");
    const currentBalance = Number(body.current_balance ?? 0);
    const lastFour = parseLastFour(body.last_four);

    if (!name) {
      return NextResponse.json(
        { error: "Account name is required" },
        { status: 400 }
      );
    }

    if (!ACCOUNT_TYPES.has(accountType)) {
      return NextResponse.json(
        { error: "Invalid account type" },
        { status: 400 }
      );
    }

    if (!ACCOUNT_PURPOSES.has(accountPurpose)) {
      return NextResponse.json(
        { error: "Invalid account purpose" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(currentBalance)) {
      return NextResponse.json(
        { error: "Current balance must be a valid number" },
        { status: 400 }
      );
    }

    if (lastFour === "invalid") {
      return NextResponse.json(
        { error: "Last four must be exactly 4 digits" },
        { status: 400 }
      );
    }

    const account = await updateAccount(userPayload.userId, accountId, {
      name,
      institution_name: body.institution_name
        ? String(body.institution_name).trim()
        : null,
      last_four: lastFour,
      account_type: accountType as "checking" | "savings" | "credit_card",
      account_purpose: accountPurpose as
        | "bills"
        | "disposable"
        | "savings"
        | "credit_card",
      current_balance: currentBalance,
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("Update account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/accounts/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId)) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }

  const account = await getAccountById(userPayload.userId, accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await deactivateAccount(userPayload.userId, accountId);
  return NextResponse.json({ success: true });
}
