import { NextResponse } from "next/server";
import { getSetupStatus } from "@/lib/server/user-service";

export async function GET() {
  return NextResponse.json(await getSetupStatus());
}
