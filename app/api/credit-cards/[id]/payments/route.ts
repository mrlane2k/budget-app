import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  addCreditCardLedgerEntries,
  getCreditCardById,
  listCreditCardTransactions,
} from "@/lib/data";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const ENTRY_TYPES = new Set([
  "purchase",
  "payment",
  "interest",
  "fee",
  "adjustment",
]);

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/credit-cards/[id]/payments">
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

  const transactions = await listCreditCardTransactions(userPayload.userId, cardId);
  return NextResponse.json(transactions);
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/credit-cards/[id]/payments">
) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const cardId = Number(id);

  try {
    const body = await request.json();

    const card = await getCreditCardById(userPayload.userId, cardId);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const paymentAmount = roundMoney(Math.max(0, Number(body.payment_amount) || 0));
    const interestAmount = roundMoney(Math.max(0, Number(body.interest_amount) || 0));
    const transactionDate =
      typeof body.payment_date === "string" && body.payment_date
        ? body.payment_date
        : new Date().toISOString().slice(0, 10);

    const rawEntries = Array.isArray(body.entries) ? (body.entries as unknown[]) : [];

    const entries = rawEntries.length > 0
      ? rawEntries
          .map((entry: unknown) => {
            const candidate =
              entry && typeof entry === "object"
                ? (entry as Record<string, unknown>)
                : null;
            const type = String(candidate?.type ?? "");
            const rawAmount = Number(candidate?.amount ?? 0);
            const amount =
              type === "adjustment"
                ? roundMoney(rawAmount || 0)
                : roundMoney(Math.max(0, rawAmount || 0));

            if (!ENTRY_TYPES.has(type) || !Number.isFinite(amount) || amount === 0) {
              return null;
            }

            return {
              type: type as "purchase" | "payment" | "interest" | "fee" | "adjustment",
              amount,
              note: candidate?.note ? String(candidate.note).trim() : null,
              category: candidate?.category ? String(candidate.category).trim() : null,
              merchant_name: candidate?.merchant_name
                ? String(candidate.merchant_name).trim()
                : null,
              source_account_id:
                candidate?.source_account_id !== undefined &&
                candidate?.source_account_id !== null &&
                Number.isFinite(Number(candidate.source_account_id))
                  ? Number(candidate.source_account_id)
                  : null,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : [];

    if (entries.length === 0) {
      if (paymentAmount > 0) {
        entries.push({
          type: "payment",
          amount: paymentAmount,
          note: body.note ? String(body.note).trim() : null,
          category: null,
          merchant_name: null,
          source_account_id: null,
        });
      }

      if (interestAmount > 0) {
        entries.push({
          type: "interest",
          amount: interestAmount,
          note: body.note ? String(body.note).trim() : null,
          category: null,
          merchant_name: null,
          source_account_id: null,
        });
      }
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Enter at least one valid ledger entry" },
        { status: 400 }
      );
    }

    const result = await addCreditCardLedgerEntries(userPayload.userId, cardId, {
      transactionDate,
      entries,
    });

    if (!result) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }

    console.error("Create credit card transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
