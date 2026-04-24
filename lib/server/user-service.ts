import bcrypt from "bcryptjs";
import type { JwtPayload } from "@/lib/auth";
import {
  changeUserPassword,
  createInitialUser,
  getAuthUserByUsername,
  getUserProfileById,
  isSetupRequired,
  updateUserSettings,
} from "@/lib/data";
import { AppError } from "@/lib/server/errors";

type SettingsUpdateInput = {
  pay_cycle?: string;
  last_paycheck_date?: string | null;
  monthly_income?: number;
  current_savings?: number;
  extra_cc_payment?: number;
  current_password?: string;
  new_password?: string;
};

function normalizeUsername(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePassword(value: unknown): string {
  return String(value ?? "");
}

export async function getSetupStatus() {
  return {
    setupRequired: await isSetupRequired(),
  };
}

export async function createInitialUserAccount(input: {
  username: unknown;
  password: unknown;
}) {
  const username = normalizeUsername(input.username);
  const password = normalizePassword(input.password);

  if (!username || !password) {
    throw new AppError("Username and password are required.", {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters.", {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return await createInitialUser({
      username,
      passwordHash,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SETUP_ALREADY_COMPLETE"
    ) {
      throw new AppError("Setup has already been completed.", {
        status: 409,
        code: "SETUP_ALREADY_COMPLETE",
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AppError("That username is already in use.", {
        status: 409,
        code: "USERNAME_TAKEN",
      });
    }

    throw error;
  }
}

export async function authenticateUser(input: {
  username: unknown;
  password: unknown;
}): Promise<JwtPayload> {
  const username = normalizeUsername(input.username);
  const password = normalizePassword(input.password);

  if (!username || !password) {
    throw new AppError("Username and password are required", {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  if (await isSetupRequired()) {
    throw new AppError("Setup is required before logging in.", {
      status: 409,
      code: "SETUP_REQUIRED",
    });
  }

  const user = await getAuthUserByUsername(username);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError("Invalid credentials", {
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
  }

  return {
    userId: user.id,
    username: user.username,
  };
}

export async function getUserSettings(userId: number) {
  const user = await getUserProfileById(userId);
  if (!user) {
    throw new AppError("User not found", {
      status: 404,
      code: "USER_NOT_FOUND",
    });
  }

  return user;
}

export async function saveUserSettings(
  user: JwtPayload,
  input: SettingsUpdateInput
) {
  if (input.current_password !== undefined || input.new_password !== undefined) {
    if (!input.current_password || !input.new_password) {
      throw new AppError("Current and new password are required", {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    if (String(input.new_password).length < 8) {
      throw new AppError("Password must be at least 8 characters.", {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const authUser = await getAuthUserByUsername(user.username);
    if (
      !authUser ||
      !(await bcrypt.compare(input.current_password, authUser.password_hash))
    ) {
      throw new AppError("Current password is incorrect", {
        status: 400,
        code: "INVALID_PASSWORD",
      });
    }

    const newHash = await bcrypt.hash(input.new_password, 10);
    await changeUserPassword(user.userId, newHash);
    return {
      success: true,
      message: "Password updated",
    };
  }

  return updateUserSettings(user.userId, {
    pay_cycle: input.pay_cycle,
    last_paycheck_date:
      input.last_paycheck_date !== undefined ? input.last_paycheck_date : undefined,
    monthly_income:
      input.monthly_income !== undefined ? Number(input.monthly_income) : undefined,
    current_savings:
      input.current_savings !== undefined ? Number(input.current_savings) : undefined,
    extra_cc_payment:
      input.extra_cc_payment !== undefined ? Number(input.extra_cc_payment) : undefined,
  });
}
