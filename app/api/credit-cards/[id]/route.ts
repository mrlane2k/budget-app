import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  deactivateCreditCard,
  getCreditCardById,
  updateCreditCard,
} from "@/lib/data";

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/credit-cards/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const cardId = Number(id);

  try {
    const { name, balance, credit_limit, minimum_payment, apr, due_day, last_four } =
      await request.json();

    const card = await getCreditCardById(userPayload.userId, cardId);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const updatedCard = await updateCreditCard(userPayload.userId, cardId, {
      name,
      balance: Number(balance),
      credit_limit: Number(credit_limit),
      minimum_payment: Number(minimum_payment),
      apr: Number(apr),
      due_day: Number(due_day),
      last_four: last_four || null,
    });

    return NextResponse.json(updatedCard);
  } catch (error) {
    console.error("Update card error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/credit-cards/[id]">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const cardId = Number(id);

  const card = await getCreditCardById(userPayload.userId, cardId);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  await deactivateCreditCard(userPayload.userId, cardId);
  return NextResponse.json({ success: true });
}
