import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createBill, listBillsForMonth } from "@/lib/data";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const bills = await listBillsForMonth(
    userPayload.userId,
    now.getFullYear(),
    now.getMonth() + 1
  );

  return NextResponse.json(bills);
}

export async function POST(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, category, amount, due_day, is_autopay, frequency, due_date } =
      await request.json();

    const freq = frequency || "monthly";

    if (!name || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Name and amount are required" },
        { status: 400 }
      );
    }

    if (freq === "monthly") {
      if (!due_day) {
        return NextResponse.json(
          { error: "due_day is required for monthly bills" },
          { status: 400 }
        );
      }
      if (due_day < 1 || due_day > 31) {
        return NextResponse.json(
          { error: "due_day must be between 1 and 31" },
          { status: 400 }
        );
      }
    } else if (!due_date) {
      return NextResponse.json(
        { error: "due_date is required for non-monthly bills" },
        { status: 400 }
      );
    }

    const bill = await createBill(userPayload.userId, {
      name,
      category: category || null,
      amount: Number(amount),
      due_day: freq === "monthly" ? Number(due_day) : 1,
      is_autopay: Boolean(is_autopay),
      frequency: freq,
      due_date: due_date || null,
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error("Create bill error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
