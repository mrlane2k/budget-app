import { request } from "@/lib/client/transport";

export type AccountType = "checking" | "savings" | "credit_card";
export type AccountPurpose = "bills" | "disposable" | "savings" | "credit_card";
export type CashDirection = "inflow" | "outflow";
export type CashTransactionKind =
  | "bill_payment"
  | "discretionary_spend"
  | "transfer"
  | "income"
  | "savings_contribution"
  | "adjustment";

export interface Account {
  id: number;
  user_id: number;
  name: string;
  institution_name: string | null;
  last_four: string | null;
  account_type: AccountType;
  account_purpose: AccountPurpose;
  current_balance: number;
  is_manual: number;
  is_active: number;
  plaid_account_id: string | null;
  created_at: string;
}

export interface CashTransaction {
  id: number;
  user_id: number;
  account_id: number;
  account_name: string;
  account_purpose: AccountPurpose;
  transaction_date: string;
  amount: number;
  direction: CashDirection;
  category: string | null;
  merchant_name: string | null;
  description: string;
  transaction_kind: CashTransactionKind;
  linked_bill_id: number | null;
  transfer_group_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface Transfer {
  id: number;
  user_id: number;
  transfer_date: string;
  amount: number;
  notes: string | null;
  from_account_id: number;
  from_account_name: string;
  to_account_id: number;
  to_account_name: string;
  created_at: string;
}

export interface AccountInput {
  name: string;
  institution_name: string;
  last_four: string;
  account_type: AccountType;
  account_purpose: AccountPurpose;
  current_balance: number;
}

export interface CashTransactionInput {
  account_id: number;
  transaction_date: string;
  amount: number;
  direction: CashDirection;
  transaction_kind: CashTransactionKind;
  category: string;
  merchant_name: string;
  description: string;
  notes: string;
  linked_bill_id?: number | null;
}

export interface TransferInput {
  from_account_id: number;
  to_account_id: number;
  transfer_date: string;
  amount: number;
  notes: string;
}

export async function listAccounts(): Promise<Account[]> {
  return request<Account[]>({
    path: "/api/accounts",
    tauriCommand: "list_accounts",
  });
}

export async function saveAccount(input: AccountInput, accountId?: number): Promise<Account> {
  const tauriInput = {
    name: input.name,
    institutionName: input.institution_name || null,
    lastFour: input.last_four || null,
    accountType: input.account_type,
    accountPurpose: input.account_purpose,
    currentBalance: input.current_balance,
  };

  return request<Account>({
    path: accountId ? `/api/accounts/${accountId}` : "/api/accounts",
    method: accountId ? "PUT" : "POST",
    body: input,
    tauriCommand: accountId ? "update_account" : "create_account",
    tauriArgs: accountId ? { accountId, ...tauriInput } : tauriInput,
  });
}

export async function deleteAccount(accountId: number): Promise<{ success: true }> {
  return request<{ success: true }>({
    path: `/api/accounts/${accountId}`,
    method: "DELETE",
    tauriCommand: "delete_account",
    tauriArgs: { accountId },
  });
}

export async function listCashTransactions(limit = 50): Promise<CashTransaction[]> {
  return request<CashTransaction[]>({
    path: `/api/cash-transactions?limit=${limit}`,
    tauriCommand: "list_cash_transactions",
    tauriArgs: { limit },
  });
}

export async function saveCashTransaction(
  input: CashTransactionInput,
  transactionId?: number
): Promise<CashTransaction> {
  const tauriInput = {
    accountId: input.account_id,
    transactionDate: input.transaction_date,
    amount: input.amount,
    direction: input.direction,
    transactionKind: input.transaction_kind,
    description: input.description,
    category: input.category || null,
    merchantName: input.merchant_name || null,
    linkedBillId: input.linked_bill_id ?? null,
    notes: input.notes || null,
  };

  return request<CashTransaction>({
    path: transactionId
      ? `/api/cash-transactions/${transactionId}`
      : "/api/cash-transactions",
    method: transactionId ? "PUT" : "POST",
    body: input,
    tauriCommand: transactionId ? "update_cash_transaction" : "create_cash_transaction",
    tauriArgs: transactionId ? { transactionId, ...tauriInput } : tauriInput,
  });
}

export async function deleteCashTransaction(
  transactionId: number
): Promise<{ success: true }> {
  return request<{ success: true }>({
    path: `/api/cash-transactions/${transactionId}`,
    method: "DELETE",
    tauriCommand: "delete_cash_transaction",
    tauriArgs: { transactionId },
  });
}

export async function listTransfers(limit = 25): Promise<Transfer[]> {
  return request<Transfer[]>({
    path: `/api/transfers?limit=${limit}`,
    tauriCommand: "list_transfers",
    tauriArgs: { limit },
  });
}

export async function createTransfer(input: TransferInput): Promise<Transfer> {
  return request<Transfer>({
    path: "/api/transfers",
    method: "POST",
    body: input,
    tauriCommand: "create_transfer",
    tauriArgs: {
      fromAccountId: input.from_account_id,
      toAccountId: input.to_account_id,
      transferDate: input.transfer_date,
      amount: input.amount,
      notes: input.notes || null,
    },
  });
}
