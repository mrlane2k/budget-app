import { request } from "@/lib/client/transport";

export interface CreditCard {
  id: number;
  name: string;
  balance: number;
  credit_limit: number;
  minimum_payment: number;
  apr: number;
  due_day: number;
  last_four: string | null;
  active: number;
}

export interface CreditCardTransaction {
  id: number;
  card_id: number;
  type: "purchase" | "payment" | "interest" | "fee" | "adjustment";
  amount: number;
  note: string | null;
  category: string | null;
  merchant_name: string | null;
  source_account_id: number | null;
  transaction_date: string;
  created_at: string;
}

export interface CreditCardInput {
  name: string;
  balance: number;
  credit_limit: number;
  minimum_payment: number;
  apr: number;
  due_day: number;
  last_four: string | null;
}

export interface CreditCardLedgerEntryInput {
  type: CreditCardTransaction["type"];
  amount: number;
  note?: string | null;
  category?: string | null;
  merchant_name?: string | null;
  source_account_id?: number | null;
}

export interface CreditCardLedgerResult {
  card: CreditCard;
  transactions: CreditCardTransaction[];
}

export interface CreditCardPaymentSummaryItem {
  paid: boolean;
  amount_paid: number;
}

export async function listCreditCards(): Promise<CreditCard[]> {
  return request<CreditCard[]>({
    path: "/api/credit-cards",
    tauriCommand: "list_credit_cards",
  });
}

export async function saveCreditCard(
  input: CreditCardInput,
  cardId?: number
): Promise<CreditCard> {
  const tauriInput = {
    name: input.name,
    balance: input.balance,
    creditLimit: input.credit_limit,
    minimumPayment: input.minimum_payment,
    apr: input.apr,
    dueDay: input.due_day,
    lastFour: input.last_four,
  };

  return request<CreditCard>({
    path: cardId ? `/api/credit-cards/${cardId}` : "/api/credit-cards",
    method: cardId ? "PUT" : "POST",
    body: input,
    tauriCommand: cardId ? "update_credit_card" : "create_credit_card",
    tauriArgs: cardId ? { cardId, ...tauriInput } : tauriInput,
  });
}

export async function deleteCreditCard(cardId: number): Promise<{ success: true }> {
  return request<{ success: true }>({
    path: `/api/credit-cards/${cardId}`,
    method: "DELETE",
    tauriCommand: "delete_credit_card",
    tauriArgs: { cardId },
  });
}

export async function listCreditCardTransactions(
  cardId: number
): Promise<CreditCardTransaction[]> {
  return request<CreditCardTransaction[]>({
    path: `/api/credit-cards/${cardId}/payments`,
    tauriCommand: "list_credit_card_transactions",
    tauriArgs: { cardId },
  });
}

export async function addCreditCardLedgerEntries(
  cardId: number,
  input: {
    transaction_date: string;
    entries: CreditCardLedgerEntryInput[];
  }
): Promise<CreditCardLedgerResult> {
  return request<CreditCardLedgerResult>({
    path: `/api/credit-cards/${cardId}/payments`,
    method: "POST",
    body: {
      payment_date: input.transaction_date,
      entries: input.entries,
    },
    tauriCommand: "add_credit_card_ledger_entries",
    tauriArgs: {
      cardId,
      transactionDate: input.transaction_date,
      entries: input.entries,
    },
  });
}

export async function getCreditCardPaymentSummary(): Promise<
  Record<number, CreditCardPaymentSummaryItem>
> {
  return request<Record<number, CreditCardPaymentSummaryItem>>({
    path: "/api/credit-cards/payment-summary",
    tauriCommand: "get_credit_card_payment_summary",
  });
}
