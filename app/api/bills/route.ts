import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createBillForUser, listCurrentMonthBills } from "@/lib/server/bill-service";
import { handleRouteError } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await listCurrentMonthBills(userPayload.userId));
  } catch (error) {
    return handleRouteError(error, "List bills error:");
  }
}

export async function POST(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bill = await createBillForUser(userPayload.userId, await request.json());
    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Create bill error:");
  }
}
