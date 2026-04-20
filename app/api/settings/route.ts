import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  changeUserPassword,
  getAuthUserByUsername,
  getUserProfileById,
  updateUserSettings,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserProfileById(userPayload.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.current_password && body.new_password) {
      const authUser = await getAuthUserByUsername(userPayload.username);
      if (
        !authUser ||
        !(await bcrypt.compare(body.current_password, authUser.password_hash))
      ) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      const newHash = await bcrypt.hash(body.new_password, 10);
      await changeUserPassword(userPayload.userId, newHash);
      return NextResponse.json({
        success: true,
        message: "Password updated",
      });
    }

    const updatedUser = await updateUserSettings(userPayload.userId, {
      pay_cycle: body.pay_cycle,
      last_paycheck_date:
        body.last_paycheck_date !== undefined ? body.last_paycheck_date : undefined,
      monthly_income:
        body.monthly_income !== undefined ? Number(body.monthly_income) : undefined,
      current_savings:
        body.current_savings !== undefined ? Number(body.current_savings) : undefined,
      extra_cc_payment:
        body.extra_cc_payment !== undefined ? Number(body.extra_cc_payment) : undefined,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
