import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  createCreditCard,
  listActiveCreditCards,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cards = await listActiveCreditCards(userPayload.userId);
  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, balance, credit_limit, minimum_payment, apr, due_day, last_four } =
      await request.json();

    if (
      !name ||
      balance === undefined ||
      credit_limit === undefined ||
      minimum_payment === undefined ||
      apr === undefined ||
      !due_day
    ) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const card = await createCreditCard(userPayload.userId, {
      name,
      balance: Number(balance),
      credit_limit: Number(credit_limit),
      minimum_payment: Number(minimum_payment),
      apr: Number(apr),
      due_day: Number(due_day),
      last_four: last_four || null,
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Create card error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
