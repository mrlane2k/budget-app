import {
  createBill,
  deactivateBill,
  getBillById,
  listBillsForMonth,
  updateBill,
} from "@/lib/data";
import { AppError } from "@/lib/server/errors";

type BillInput = {
  name?: unknown;
  category?: unknown;
  amount?: unknown;
  due_day?: unknown;
  is_autopay?: unknown;
  frequency?: unknown;
  due_date?: unknown;
};

type NormalizedBillInput = {
  name: string;
  category: string | null;
  amount: number;
  due_day: number;
  is_autopay: boolean;
  frequency: string;
  due_date: string | null;
};

function normalizeBillInput(input: BillInput): NormalizedBillInput {
  const name = String(input.name ?? "").trim();
  const frequency = String(input.frequency ?? "monthly");
  const amount = Number(input.amount);
  const dueDay = input.due_day === undefined ? undefined : Number(input.due_day);
  const dueDate =
    input.due_date === undefined || input.due_date === null || input.due_date === ""
      ? null
      : String(input.due_date);

  if (!name || input.amount === undefined || input.amount === null) {
    throw new AppError("Name and amount are required", {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  if (!Number.isFinite(amount)) {
    throw new AppError("Amount must be a valid number", {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  if (frequency === "monthly") {
    if (!dueDay || dueDay < 1 || dueDay > 31) {
      throw new AppError("due_day (1-31) is required for monthly bills", {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }
  } else if (!dueDate) {
    throw new AppError("due_date is required for non-monthly bills", {
      status: 400,
      code: "VALIDATION_ERROR",
    });
  }

  return {
    name,
    category: input.category ? String(input.category) : null,
    amount,
    due_day: frequency === "monthly" ? Number(dueDay) : 1,
    is_autopay: Boolean(input.is_autopay),
    frequency,
    due_date: dueDate,
  };
}

export async function listCurrentMonthBills(userId: number) {
  const now = new Date();
  return listBillsForMonth(userId, now.getFullYear(), now.getMonth() + 1);
}

export async function createBillForUser(userId: number, input: BillInput) {
  return createBill(userId, normalizeBillInput(input));
}

export async function updateBillForUser(
  userId: number,
  billId: number,
  input: BillInput
) {
  const existingBill = await getBillById(userId, billId);
  if (!existingBill) {
    throw new AppError("Bill not found", {
      status: 404,
      code: "BILL_NOT_FOUND",
    });
  }

  return updateBill(userId, billId, normalizeBillInput(input));
}

export async function deleteBillForUser(userId: number, billId: number) {
  const bill = await getBillById(userId, billId);
  if (!bill) {
    throw new AppError("Bill not found", {
      status: 404,
      code: "BILL_NOT_FOUND",
    });
  }

  await deactivateBill(userId, billId);
  return { success: true };
}
