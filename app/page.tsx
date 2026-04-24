'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { getNextDueDate } from '@/lib/bills';
import { listBills, type Bill } from '@/lib/client/bill-client';
import { getErrorMessage } from '@/lib/client/errors';
import { getSettings, type UserSettings } from '@/lib/client/user-client';
import { useProtectedRoute } from '@/lib/client/use-protected-route';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function normalizeToMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'quarterly':
      return amount / 3;
    case 'semi-annually':
      return amount / 6;
    case 'annually':
      return amount / 12;
    default:
      return amount;
  }
}

function getPaychecksPerMonth(payCycle: string): number {
  switch (payCycle) {
    case 'weekly':
      return 4.33;
    case 'bi-weekly':
      return 2.17;
    case 'semi-monthly':
      return 2;
    case 'monthly':
      return 1;
    default:
      return 2.17;
  }
}

function getNextPaycheckDate(payCycle: string, lastPaycheckDate: string): Date {
  const last = new Date(`${lastPaycheckDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next = new Date(last);

  const advance = (date: Date) => {
    switch (payCycle) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'bi-weekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'semi-monthly': {
        const day = date.getDate();
        if (day < 15) {
          date.setDate(15);
        } else {
          date.setMonth(date.getMonth() + 1, 1);
        }
        break;
      }
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
    }
  };

  advance(next);
  while (next <= today) {
    advance(next);
  }
  return next;
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const { checkingAuth, authError } = useProtectedRoute();
  const [bills, setBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (checkingAuth || authError) {
      return;
    }

    async function loadDashboard() {
      try {
        const [billData, settingsData] = await Promise.all([listBills(), getSettings()]);
        setBills(Array.isArray(billData) ? billData : []);
        setSettings(settingsData);
        setError('');
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Failed to load dashboard.'));
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [authError, checkingAuth]);

  const now = new Date();
  const totalMonthlyBills = bills.reduce(
    (sum, bill) => sum + normalizeToMonthly(bill.amount, bill.frequency || 'monthly'),
    0,
  );
  const paidBills = bills.filter((bill) => bill.status === 'paid');
  const totalPaid = paidBills.reduce(
    (sum, bill) => sum + (bill.amount_paid ?? bill.amount),
    0,
  );
  const remainingBills = Math.max(totalMonthlyBills - totalPaid, 0);

  const upcomingBills = bills
    .filter((bill) => bill.status !== 'paid')
    .map((bill) => ({
      bill,
      dueDate: getNextDueDate(bill),
    }))
    .filter((item) => item.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 5);

  const paychecksPerMonth = settings ? getPaychecksPerMonth(settings.pay_cycle) : 2.17;
  const estimatedPerPaycheckBills =
    paychecksPerMonth > 0 ? totalMonthlyBills / paychecksPerMonth : totalMonthlyBills;

  let nextPaycheckLabel = 'Add your pay cycle in Settings';
  let nextPaycheckDaysLabel = 'No paycheck schedule yet';
  if (settings?.last_paycheck_date) {
    const nextPaycheck = getNextPaycheckDate(
      settings.pay_cycle,
      settings.last_paycheck_date,
    );
    const days = daysUntil(nextPaycheck);
    nextPaycheckLabel = nextPaycheck.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    nextPaycheckDaysLabel =
      days === 0 ? 'Today' : days === 1 ? 'In 1 day' : `In ${days} days`;
  }

  if (checkingAuth || loading) {
    return (
      <div className="flex min-h-screen">
        <Nav />
        <main className="ml-56 flex flex-1 items-center justify-center p-8">
          <div className="text-gray-400">
            {checkingAuth ? 'Checking session...' : 'Loading dashboard...'}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Overview</h1>
              <p className="mt-1 text-gray-400">
                {now.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/bills"
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Manage Bills
              </Link>
              <Link
                href="/settings"
                className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
              >
                Open Settings
              </Link>
            </div>
          </div>

          {(authError || error) && (
            <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
              {authError || error}
            </div>
          )}

          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Monthly Bills
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(totalMonthlyBills)}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {bills.length} active bills tracked
              </p>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Paid This Month
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(totalPaid)}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {paidBills.length} of {bills.length} marked paid
              </p>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Remaining Bills
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(remainingBills)}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Estimated {formatCurrency(estimatedPerPaycheckBills)} per paycheck
              </p>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Next Paycheck
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {settings?.monthly_income
                  ? formatCurrency(settings.monthly_income)
                  : formatCurrency(0)}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {nextPaycheckLabel} • {nextPaycheckDaysLabel}
              </p>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Upcoming Bills</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Your next obligations from the desktop-native billing slice
                  </p>
                </div>
                <Link
                  href="/bills"
                  className="text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
                >
                  View all
                </Link>
              </div>

              {upcomingBills.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 bg-gray-950/40 px-4 py-8 text-center text-sm text-gray-500">
                  No upcoming unpaid bills yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBills.map(({ bill, dueDate }) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/40 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-white">{bill.name}</p>
                        <p className="mt-1 text-sm text-gray-400">
                          Due{' '}
                          {dueDate?.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          • {daysUntil(dueDate!)} day{daysUntil(dueDate!) === 1 ? '' : 's'} away
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">{formatCurrency(bill.amount)}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {bill.is_autopay === 1 ? 'Autopay' : 'Manual'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="text-lg font-semibold text-white">Desktop Status</h2>
                <p className="mt-2 text-sm text-gray-400">
                  The desktop app is now using native setup, login, settings, bills, credit cards, cash buckets, and vault flows.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  <li>Billing is fully local and encrypted at rest.</li>
                  <li>Vault controls live in Settings.</li>
                  <li>Cash buckets and card ledgers now run against the local encrypted database.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h2 className="text-lg font-semibold text-white">What’s Next</h2>
                <p className="mt-2 text-sm text-gray-400">
                  The core budgeting, reporting, and month-end flows now run locally. The next cleanup work is mostly polish, exports, and desktop-native refinement.
                </p>
                <div className="mt-4 space-y-3">
                  <Link
                    href="/cash"
                    className="block rounded-lg border border-gray-800 bg-gray-950/40 px-4 py-3 text-sm text-gray-200 transition-colors hover:bg-gray-800"
                  >
                    Open Cash Buckets
                  </Link>
                  <Link
                    href="/credit-cards"
                    className="block rounded-lg border border-gray-800 bg-gray-950/40 px-4 py-3 text-sm text-gray-200 transition-colors hover:bg-gray-800"
                  >
                    Open Credit Cards
                  </Link>
                  <Link
                    href="/calendar"
                    className="block rounded-lg border border-gray-800 bg-gray-950/40 px-4 py-3 text-sm text-gray-200 transition-colors hover:bg-gray-800"
                  >
                    Review Monthly Close
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
