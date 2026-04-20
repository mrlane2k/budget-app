import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  deleteCashTransaction,
  getCashTransactionById,
  updateCashTransaction,
} from "@/lib/data";

const DIRECTIONS = new Set(["inflow", "outflow"]);
const KINDS = new Set([
  "bill_payment",
  "discretionary_spend",
  "transfer",
  "income",
  "savings_contribution",
  "adjustment",
]);

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/cash-transactions/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const transactionId = Number(id);
    if (!Number.isFinite(transactionId)) {
      return NextResponse.json(
        { error: "Invalid transaction id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const accountId = Number(body.account_id);
    const amount = Number(body.amount);
    const direction = String(body.direction ?? "");
    const kind = String(body.transaction_kind ?? "");
    const description = String(body.description ?? "").trim();
    const transactionDate = String(body.transaction_date ?? "");

    if (!Number.isFinite(accountId)) {
      return NextResponse.json({ error: "Account is required" }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (!DIRECTIONS.has(direction) || !KINDS.has(kind) || !description || !transactionDate) {
      return NextResponse.json(
        { error: "Invalid transaction payload" },
        { status: 400 }
      );
    }

    const transaction = await updateCashTransaction(userPayload.userId, transactionId, {
      account_id: accountId,
      transaction_date: transactionDate,
      amount,
      direction: direction as "inflow" | "outflow",
      category: body.category ? String(body.category).trim() : null,
      merchant_name: body.merchant_name ? String(body.merchant_name).trim() : null,
      description,
      transaction_kind: kind as
        | "bill_payment"
        | "discretionary_spend"
        | "transfer"
        | "income"
        | "savings_contribution"
        | "adjustment",
      linked_bill_id:
        body.linked_bill_id !== undefined && body.linked_bill_id !== null
          ? Number(body.linked_bill_id)
          : null,
      notes: body.notes ? String(body.notes).trim() : null,
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "TRANSFER_TRANSACTION_IMMUTABLE"
    ) {
      return NextResponse.json(
        { error: "Transfer transactions cannot be edited directly" },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    console.error("Update cash transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/cash-transactions/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const transactionId = Number(id);
    if (!Number.isFinite(transactionId)) {
      return NextResponse.json(
        { error: "Invalid transaction id" },
        { status: 400 }
      );
    }

    const existing = await getCashTransactionById(userPayload.userId, transactionId);
    if (!existing) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    await deleteCashTransaction(userPayload.userId, transactionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "TRANSFER_TRANSACTION_IMMUTABLE"
    ) {
      return NextResponse.json(
        { error: "Transfer transactions cannot be deleted directly" },
        { status: 400 }
      );
    }

    console.error("Delete cash transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
