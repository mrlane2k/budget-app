import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  deactivateBill,
  getBillById,
  updateBill,
} from "@/lib/data";

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/bills/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const billId = Number(id);

  try {
    const { name, category, amount, due_day, is_autopay, frequency, due_date } =
      await request.json();
    const freq = frequency || "monthly";

    const existingBill = await getBillById(userPayload.userId, billId);
    if (!existingBill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    if (freq === "monthly") {
      if (!due_day || due_day < 1 || due_day > 31) {
        return NextResponse.json(
          { error: "due_day (1-31) is required for monthly bills" },
          { status: 400 }
        );
      }
    } else if (!due_date) {
      return NextResponse.json(
        { error: "due_date is required for non-monthly bills" },
        { status: 400 }
      );
    }

    const updatedBill = await updateBill(userPayload.userId, billId, {
      name,
      category: category || null,
      amount: Number(amount),
      due_day: freq === "monthly" ? Number(due_day) : 1,
      is_autopay: Boolean(is_autopay),
      frequency: freq,
      due_date: due_date || null,
    });

    return NextResponse.json(updatedBill);
  } catch (error) {
    console.error("Update bill error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/bills/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const billId = Number(id);

  const bill = await getBillById(userPayload.userId, billId);
  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  await deactivateBill(userPayload.userId, billId);
  return NextResponse.json({ success: true });
}
