import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { deleteBillForUser, updateBillForUser } from "@/lib/server/bill-service";
import { handleRouteError } from "@/lib/server/http";

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
    return NextResponse.json(
      await updateBillForUser(userPayload.userId, billId, await request.json())
    );
  } catch (error) {
    return handleRouteError(error, "Update bill error:");
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

  try {
    return NextResponse.json(await deleteBillForUser(userPayload.userId, billId));
  } catch (error) {
    return handleRouteError(error, "Delete bill error:");
  }
}
