import { NextResponse } from "next/server";
import { isSetupRequired } from "@/lib/data";

export async function GET() {
  const setupRequired = await isSetupRequired();
  return NextResponse.json({ setupRequired });
}
