import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createTransfer, listTransfers } from "@/lib/data";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") ?? "25");
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 25;

  const transfers = await listTransfers(userPayload.userId, limit);
  return NextResponse.json(transfers);
}

export async function POST(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fromAccountId = Number(body.from_account_id);
    const toAccountId = Number(body.to_account_id);
    const amount = Number(body.amount);
    const transferDate = String(body.transfer_date ?? "");

    if (!Number.isFinite(fromAccountId) || !Number.isFinite(toAccountId)) {
      return NextResponse.json(
        { error: "Both accounts are required" },
        { status: 400 }
      );
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json(
        { error: "Transfer accounts must be different" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (!transferDate) {
      return NextResponse.json(
        { error: "Transfer date is required" },
        { status: 400 }
      );
    }

    const transfer = await createTransfer(userPayload.userId, {
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      transfer_date: transferDate,
      amount,
      notes: body.notes ? String(body.notes).trim() : null,
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer could not be created" },
        { status: 400 }
      );
    }

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    console.error("Create transfer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
