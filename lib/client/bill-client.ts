import { request } from "@/lib/client/transport";

export interface Bill {
  id: number;
  name: string;
  category: string | null;
  amount: number;
  due_day: number;
  due_date: string | null;
  is_autopay: number;
  active: number;
  status: string | null;
  amount_paid: number | null;
  payment_id: number | null;
  frequency: string;
}

export interface BillInput {
  name: string;
  category: string;
  amount: number;
  due_day: number;
  due_date: string | null;
  is_autopay: boolean;
  frequency: string;
}

export async function listBills(): Promise<Bill[]> {
  return request<Bill[]>({
    path: "/api/bills",
    tauriCommand: "list_bills",
  });
}

export async function saveBill(input: BillInput, billId?: number): Promise<Bill> {
  const tauriInput = {
    name: input.name,
    category: input.category,
    amount: input.amount,
    dueDay: input.due_day,
    due_day: input.due_day,
    dueDate: input.due_date,
    due_date: input.due_date,
    isAutopay: input.is_autopay,
    is_autopay: input.is_autopay,
    frequency: input.frequency,
  };

  return request<Bill>({
    path: billId ? `/api/bills/${billId}` : "/api/bills",
    method: billId ? "PUT" : "POST",
    body: input,
    tauriCommand: billId ? "update_bill" : "create_bill",
    tauriArgs: billId ? { billId, bill_id: billId, ...tauriInput } : tauriInput,
  });
}

export async function deleteBill(billId: number): Promise<{ success: true }> {
  return request<{ success: true }>({
    path: `/api/bills/${billId}`,
    method: "DELETE",
    tauriCommand: "delete_bill",
    tauriArgs: { billId, bill_id: billId },
  });
}

export async function upsertBillPayment(
  billId: number,
  input: {
    year: number;
    month: number;
    status: string;
    amount_paid: number | null;
  }
): Promise<unknown> {
  return request<unknown>({
    path: `/api/bills/${billId}/payments`,
    method: "POST",
    body: input,
    tauriCommand: "upsert_bill_payment",
    tauriArgs: {
      billId,
      bill_id: billId,
      year: input.year,
      month: input.month,
      status: input.status,
      amountPaid: input.amount_paid,
      amount_paid: input.amount_paid,
    },
  });
}
