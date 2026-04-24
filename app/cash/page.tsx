'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import {
  createTransfer,
  deleteAccount,
  deleteCashTransaction,
  listAccounts,
  listCashTransactions,
  listTransfers,
  saveAccount,
  saveCashTransaction,
  type Account,
  type AccountPurpose,
  type AccountType,
  type CashDirection,
  type CashTransaction,
  type CashTransactionKind,
  type Transfer,
} from '@/lib/client/cash-client';
import { getErrorMessage } from '@/lib/client/errors';
import { useProtectedRoute } from '@/lib/client/use-protected-route';

const today = new Date().toISOString().slice(0, 10);

const blankAccountForm = {
  name: '',
  institution_name: '',
  last_four: '',
  account_type: 'checking' as AccountType,
  account_purpose: 'bills' as AccountPurpose,
  current_balance: '0',
};

const blankTransactionForm = {
  account_id: '',
  transaction_date: today,
  amount: '',
  direction: 'outflow' as CashDirection,
  transaction_kind: 'discretionary_spend' as CashTransactionKind,
  category: '',
  merchant_name: '',
  description: '',
  notes: '',
};

const blankTransferForm = {
  from_account_id: '',
  to_account_id: '',
  transfer_date: today,
  amount: '',
  notes: '',
};

const purposeLabels: Record<AccountPurpose, string> = {
  bills: 'Bills',
  disposable: 'Disposable',
  savings: 'Savings',
  credit_card: 'Credit Card',
};

const kindLabels: Record<CashTransactionKind, string> = {
  bill_payment: 'Bill Payment',
  discretionary_spend: 'Disposable Spend',
  transfer: 'Transfer',
  income: 'Income',
  savings_contribution: 'Savings Contribution',
  adjustment: 'Adjustment',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function sumAmounts(items: CashTransaction[], predicate: (item: CashTransaction) => boolean) {
  return items.reduce((sum, item) => sum + (predicate(item) ? item.amount : 0), 0);
}

function purposeBadgeClass(purpose: AccountPurpose) {
  if (purpose === 'bills') return 'bg-blue-500/15 text-blue-300';
  if (purpose === 'disposable') return 'bg-amber-500/15 text-amber-300';
  if (purpose === 'savings') return 'bg-emerald-500/15 text-emerald-300';
  return 'bg-violet-500/15 text-violet-300';
}

function formatAccountLabel(account: Account) {
  return account.last_four ? `${account.name} (...${account.last_four})` : account.name;
}

export default function CashPage() {
  const { checkingAuth, authError } = useProtectedRoute();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);

  const [accountForm, setAccountForm] = useState(blankAccountForm);
  const [transactionForm, setTransactionForm] = useState(blankTransactionForm);
  const [transferForm, setTransferForm] = useState(blankTransferForm);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [accountsData, transactionsData, transfersData] = await Promise.all([
        listAccounts(),
        listCashTransactions(200),
        listTransfers(60),
      ]);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      setTransfers(Array.isArray(transfersData) ? transfersData : []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError, 'Failed to load cash buckets.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (checkingAuth || authError) {
      return;
    }

    void fetchData();
  }, [authError, checkingAuth]);

  function resetAccountForm() {
    setEditingAccountId(null);
    setAccountForm(blankAccountForm);
  }

  function resetTransactionForm() {
    setEditingTransactionId(null);
    setTransactionForm(blankTransactionForm);
  }

  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await saveAccount(
        {
          ...accountForm,
          current_balance: parseFloat(accountForm.current_balance || '0'),
        },
        editingAccountId ?? undefined,
      );
      resetAccountForm();
      await fetchData();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Failed to save account.'));
    } finally {
      setSaving(false);
    }
  }

  async function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await saveCashTransaction(
        {
          ...transactionForm,
          account_id: Number(transactionForm.account_id),
          amount: parseFloat(transactionForm.amount || '0'),
        },
        editingTransactionId ?? undefined,
      );
      resetTransactionForm();
      await fetchData();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Failed to save transaction.'));
    } finally {
      setSaving(false);
    }
  }

  async function submitTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await createTransfer({
        ...transferForm,
        from_account_id: Number(transferForm.from_account_id),
        to_account_id: Number(transferForm.to_account_id),
        amount: parseFloat(transferForm.amount || '0'),
      });
      setTransferForm(blankTransferForm);
      await fetchData();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Failed to create transfer.'));
    } finally {
      setSaving(false);
    }
  }

  function startEditingAccount(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      institution_name: account.institution_name ?? '',
      last_four: account.last_four ?? '',
      account_type: account.account_type,
      account_purpose: account.account_purpose,
      current_balance: String(account.current_balance),
    });
  }

  function startEditingTransaction(transaction: CashTransaction) {
    if (transaction.transfer_group_id) {
      return;
    }

    setEditingTransactionId(transaction.id);
    setTransactionForm({
      account_id: String(transaction.account_id),
      transaction_date: transaction.transaction_date,
      amount: String(transaction.amount),
      direction: transaction.direction,
      transaction_kind: transaction.transaction_kind,
      category: transaction.category ?? '',
      merchant_name: transaction.merchant_name ?? '',
      description: transaction.description,
      notes: transaction.notes ?? '',
    });
  }

  async function deactivateAccount(account: Account) {
    if (!window.confirm(`Deactivate "${account.name}"?`)) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await deleteAccount(account.id);
      if (editingAccountId === account.id) {
        resetAccountForm();
      }
      await fetchData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Failed to deactivate account.'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(transaction: CashTransaction) {
    if (transaction.transfer_group_id) {
      return;
    }

    if (!window.confirm(`Delete "${transaction.description}"?`)) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await deleteCashTransaction(transaction.id);
      if (editingTransactionId === transaction.id) {
        resetTransactionForm();
      }
      await fetchData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Failed to delete transaction.'));
    } finally {
      setSaving(false);
    }
  }

  const billsBalance = accounts.filter((a) => a.account_purpose === 'bills').reduce((sum, a) => sum + a.current_balance, 0);
  const disposableBalance = accounts.filter((a) => a.account_purpose === 'disposable').reduce((sum, a) => sum + a.current_balance, 0);
  const savingsBalance = accounts.filter((a) => a.account_purpose === 'savings').reduce((sum, a) => sum + a.current_balance, 0);
  const currentMonthKey = today.slice(0, 7);
  const currentMonthTransactions = transactions.filter((transaction) =>
    transaction.transaction_date.startsWith(currentMonthKey)
  );
  const billsPaid = sumAmounts(
    currentMonthTransactions,
    (transaction) => transaction.direction === 'outflow' && transaction.transaction_kind === 'bill_payment'
  );
  const disposableSpend = sumAmounts(
    currentMonthTransactions,
    (transaction) =>
      transaction.direction === 'outflow' && transaction.transaction_kind === 'discretionary_spend'
  );
  const savingsAdded = sumAmounts(
    currentMonthTransactions,
    (transaction) => transaction.direction === 'inflow' && transaction.account_purpose === 'savings'
  );
  const incomeReceived = sumAmounts(
    currentMonthTransactions,
    (transaction) => transaction.direction === 'inflow' && transaction.transaction_kind === 'income'
  );

  if (checkingAuth || loading) {
    return (
      <div className="flex min-h-screen">
        <Nav />
        <main className="ml-56 flex-1 p-8 flex items-center justify-center">
          <div className="text-gray-400">{checkingAuth ? 'Checking session...' : 'Loading...'}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Cash Buckets</h1>
              <p className="mt-1 text-gray-400">
                Separate bills, disposable spending, and savings cash flow.
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Tracking for {formatMonthLabel(new Date(`${currentMonthKey}-01T12:00:00`))}
            </p>
          </div>

          {authError || error ? (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {authError || error}
            </div>
          ) : null}

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Bills Checking</p>
              <p className="mt-2 text-2xl font-bold text-blue-300">{formatCurrency(billsBalance)}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Disposable Checking</p>
              <p className="mt-2 text-2xl font-bold text-amber-300">
                {formatCurrency(disposableBalance)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Savings</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">{formatCurrency(savingsBalance)}</p>
            </div>
          </div>

          <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">This Month&apos;s Activity</h2>
              <p className="text-xs text-gray-500">Based on manual bucket entries and transfers.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Bills Paid</p>
                <p className="mt-2 text-xl font-semibold text-blue-300">{formatCurrency(billsPaid)}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Disposable Spend</p>
                <p className="mt-2 text-xl font-semibold text-amber-300">
                  {formatCurrency(disposableSpend)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Savings Added</p>
                <p className="mt-2 text-xl font-semibold text-emerald-300">{formatCurrency(savingsAdded)}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Income Received</p>
                <p className="mt-2 text-xl font-semibold text-cyan-300">{formatCurrency(incomeReceived)}</p>
              </div>
            </div>
          </section>

          <div className="mb-8 grid gap-6 xl:grid-cols-3">
            <form
              onSubmit={submitAccount}
              className="space-y-3 rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">
                  {editingAccountId ? 'Edit Account' : 'Add Account'}
                </h2>
                {editingAccountId ? (
                  <button
                    type="button"
                    onClick={resetAccountForm}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
              <input
                value={accountForm.name}
                onChange={(event) =>
                  setAccountForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                placeholder="Bills Checking"
              />
              <input
                value={accountForm.institution_name}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    institution_name: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                placeholder="Institution (optional)"
              />
              <input
                value={accountForm.last_four}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    last_four: event.target.value.replace(/\D/g, '').slice(0, 4),
                  }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                inputMode="numeric"
                placeholder="Last four digits (optional)"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={accountForm.account_type}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      account_type: event.target.value as AccountType,
                    }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit Card</option>
                </select>
                <select
                  value={accountForm.account_purpose}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      account_purpose: event.target.value as AccountPurpose,
                    }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                >
                  <option value="bills">Bills</option>
                  <option value="disposable">Disposable</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>
              <input
                type="number"
                step="0.01"
                value={accountForm.current_balance}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    current_balance: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                placeholder="Current balance"
              />
              <button
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {editingAccountId ? 'Save Account' : 'Create Account'}
              </button>
            </form>

            <form
              onSubmit={submitTransaction}
              className="space-y-3 rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">
                  {editingTransactionId ? 'Edit Cash Transaction' : 'Add Cash Transaction'}
                </h2>
                {editingTransactionId ? (
                  <button
                    type="button"
                    onClick={resetTransactionForm}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
              <select
                value={transactionForm.account_id}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    account_id: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatAccountLabel(account)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={transactionForm.transaction_date}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      transaction_date: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transactionForm.amount}
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                  placeholder="Amount"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={transactionForm.direction}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      direction: event.target.value as CashDirection,
                    }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                >
                  <option value="outflow">Outflow</option>
                  <option value="inflow">Inflow</option>
                </select>
                <select
                  value={transactionForm.transaction_kind}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      transaction_kind: event.target.value as CashTransactionKind,
                    }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                >
                  <option value="discretionary_spend">Disposable Spend</option>
                  <option value="bill_payment">Bill Payment</option>
                  <option value="income">Income</option>
                  <option value="savings_contribution">Savings Contribution</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <input
                value={transactionForm.description}
                onChange={(event) =>
                  setTransactionForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                placeholder="Description"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={transactionForm.category}
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, category: event.target.value }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                  placeholder="Category (optional)"
                />
                <input
                  value={transactionForm.merchant_name}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      merchant_name: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                  placeholder="Merchant (optional)"
                />
              </div>
              <input
                value={transactionForm.notes}
                onChange={(event) =>
                  setTransactionForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                placeholder="Notes (optional)"
              />
              <button
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                Save Transaction
              </button>
            </form>

            <form
              onSubmit={submitTransfer}
              className="space-y-3 rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <h2 className="text-base font-semibold text-white">Record Transfer</h2>
              <select
                value={transferForm.from_account_id}
                onChange={(event) =>
                  setTransferForm((current) => ({
                    ...current,
                    from_account_id: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
              >
                <option value="">From account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatAccountLabel(account)}
                  </option>
                ))}
              </select>
              <select
                value={transferForm.to_account_id}
                onChange={(event) =>
                  setTransferForm((current) => ({
                    ...current,
                    to_account_id: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
              >
                <option value="">To account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatAccountLabel(account)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={transferForm.transfer_date}
                  onChange={(event) =>
                    setTransferForm((current) => ({
                      ...current,
                      transfer_date: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transferForm.amount}
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                  placeholder="Amount"
                />
              </div>
              <input
                value={transferForm.notes}
                onChange={(event) =>
                  setTransferForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                placeholder="Notes (optional)"
              />
              <button
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                Save Transfer
              </button>
            </form>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Accounts</h2>
                <p className="text-xs text-gray-500">Manage bucket balances and supporting accounts.</p>
              </div>
              <div className="space-y-3">
                {accounts.length === 0 ? (
                  <p className="text-sm text-gray-500">No accounts yet.</p>
                ) : (
                  accounts.map((account) => (
                    <div
                      key={`account-active-${account.id}`}
                      className="rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{account.name}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${purposeBadgeClass(account.account_purpose)}`}
                            >
                              {purposeLabels[account.account_purpose]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {account.account_type.replace('_', ' ')}
                            {account.institution_name ? ` / ${account.institution_name}` : ''}
                            {account.last_four ? ` / ending in ${account.last_four}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-white">
                            {formatCurrency(account.current_balance)}
                          </p>
                          <button
                            type="button"
                            onClick={() => startEditingAccount(account)}
                            className="text-xs font-medium text-blue-300 hover:text-blue-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deactivateAccount(account)}
                            className="text-xs font-medium text-red-300 hover:text-red-200"
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Recent Transfers</h2>
                <p className="text-xs text-gray-500">
                  Transfers automatically create paired bucket entries.
                </p>
              </div>
              <div className="space-y-3">
                {transfers.length === 0 ? (
                  <p className="text-sm text-gray-500">No transfers yet.</p>
                ) : (
                  transfers.slice(0, 10).map((transfer) => (
                    <div
                      key={`transfer-active-${transfer.id}`}
                      className="rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {transfer.from_account_name} to {transfer.to_account_name}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {transfer.transfer_date}
                            {transfer.notes ? ` / ${transfer.notes}` : ''}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-300">
                          {formatCurrency(transfer.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>


          <section className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Recent Cash Transactions</h2>
              <p className="text-xs text-gray-500">
                Manual transactions can be edited here. Transfer entries stay locked.
              </p>
            </div>
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-500">No cash transactions yet.</p>
              ) : (
                transactions.slice(0, 20).map((transaction) => (
                  <div
                    key={`transaction-active-${transaction.id}`}
                    className="rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{transaction.description}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${purposeBadgeClass(transaction.account_purpose)}`}
                          >
                            {purposeLabels[transaction.account_purpose]}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {transaction.transaction_date} / {transaction.account_name} /{' '}
                          {kindLabels[transaction.transaction_kind]}
                          {transaction.category ? ` / ${transaction.category}` : ''}
                          {transaction.merchant_name ? ` / ${transaction.merchant_name}` : ''}
                        </p>
                        {transaction.notes ? (
                          <p className="mt-1 text-xs text-gray-500">{transaction.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <p
                          className={`text-sm font-semibold ${
                            transaction.direction === 'inflow'
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {transaction.direction === 'inflow' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </p>
                        {transaction.transfer_group_id ? (
                          <span className="text-xs text-gray-500">Transfer-managed</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingTransaction(transaction)}
                              className="text-xs font-medium text-blue-300 hover:text-blue-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTransaction(transaction)}
                              className="text-xs font-medium text-red-300 hover:text-red-200"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
