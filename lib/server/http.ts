import { NextResponse } from "next/server";
import { isAppError } from "@/lib/server/errors";

export function handleRouteError(error: unknown, context: string) {
  if (isAppError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(context, error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
