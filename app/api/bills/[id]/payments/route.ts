import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  getBillById,
  getBillPayment,
  upsertBillPayment,
} from "@/lib/data";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/bills/[id]/payments">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const billId = Number(id);
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") || new Date().getFullYear());
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);

  const bill = await getBillById(userPayload.userId, billId);
  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const payment = await getBillPayment(userPayload.userId, billId, year, month);
  return NextResponse.json(
    payment || { bill_id: billId, year, month, status: "unpaid", amount_paid: null }
  );
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/bills/[id]/payments">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const billId = Number(id);

  try {
    const { year, month, status, amount_paid } = await request.json();

    const bill = await getBillById(userPayload.userId, billId);
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    const paidAt = status === "paid" ? new Date().toISOString() : null;
    const payment = await upsertBillPayment(userPayload.userId, billId, {
      year: Number(year),
      month: Number(month),
      status,
      amount_paid: amount_paid ? Number(amount_paid) : null,
      paid_at: paidAt,
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Update payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
