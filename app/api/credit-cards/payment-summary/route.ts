import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getCreditCardPaymentSummary } from "@/lib/data";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getCreditCardPaymentSummary(userPayload.userId);
  return NextResponse.json(summary);
}
