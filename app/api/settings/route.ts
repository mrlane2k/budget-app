import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/server/http";
import { getUserSettings, saveUserSettings } from "@/lib/server/user-service";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getUserSettings(userPayload.userId));
  } catch (error) {
    return handleRouteError(error, "Get settings error:");
  }
}

export async function PUT(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(
      await saveUserSettings(userPayload, await request.json())
    );
  } catch (error) {
    return handleRouteError(error, "Update settings error:");
  }
}
