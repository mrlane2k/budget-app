'use client';
import { apiPath } from '@/lib/basepath';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { getNextDueDate } from '@/lib/bills';

interface Bill {
  id: number;
  name: string;
  category: string;
  amount: number;
  due_day: number;
  due_date: string | null;
  is_autopay: number;
  status: string | null;
  amount_paid: number | null;
  frequency: string;
}

interface CreditCard {
  id: number;
  name: string;
  balance: number;
  credit_limit: number;
  minimum_payment: number;
  apr: number;
  due_day: number;
}

interface UserSettings {
  pay_cycle: string;
  last_paycheck_date: string;
  monthly_income: number;
  current_savings: number;
  extra_cc_payment: number;
}

interface BudgetComparison {
  month: string;
  label: string;
  budget: {
    bills_budget: number;
    disposable_budget: number;
    savings_target: number;
    extra_debt_payment_target: number;
  } | null;
  actuals: {
    bills: number;
    disposable: number;
    savings: number;
    extraDebt: number;
  };
  variances: {
    bills: number;
    disposable: number;
    savings: number;
    extraDebt: number;
  };
  plannedTotal: number | null;
  actualTotal: number;
  monthStatus: 'open' | 'closed';
  closedAt: string | null;
  insights: string[];
}

function normalizeToMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'quarterly': return amount / 3;
    case 'semi-annually': return amount / 6;
    case 'annually': return amount / 12;
    default: return amount;
  }
}

function getPaychecksPerMonth(payCycle: string): number {
  switch (payCycle) {
    case 'weekly': return 4.33;
    case 'bi-weekly': return 2.17;
    case 'semi-monthly': return 2;
    case 'monthly': return 1;
    default: return 2.17;
  }
}

function getNextPaycheckDate(payCycle: string, lastPaycheckDate: string): Date {
  const last = new Date(lastPaycheckDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next = new Date(last);

  const advance = (d: Date) => {
    switch (payCycle) {
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'bi-weekly': d.setDate(d.getDate() + 14); break;
      case 'semi-monthly': {
        const day = d.getDate();
        if (day < 15) { d.setDate(15); }
        else { d.setMonth(d.getMonth() + 1, 1); }
        break;
      }
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
    }
  };

  advance(next);
  while (next <= today) advance(next);
  return next;
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function budgetVarianceTone(label: 'spending' | 'goal', variance: number) {
  if (Math.abs(variance) < 0.01) return 'text-gray-300';
  if (label === 'goal') return variance >= 0 ? 'text-emerald-400' : 'text-red-400';
  return variance <= 0 ? 'text-emerald-400' : 'text-red-400';
}

export default function DashboardPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [ccPaymentSummary, setCcPaymentSummary] = useState<Record<number, { paid: boolean; amount_paid: number }>>({});
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetMonths, setTargetMonths] = useState(6);
  const [extraCCPayment, setExtraCCPayment] = useState(0);
  const now = new Date();
  const saveExtraCC = async (val: number) => {
    setExtraCCPayment(val);
    localStorage.setItem('budget_extra_payment', String(val));
    await fetch(apiPath('/api/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_cc_payment: val }),
    });
  };

  useEffect(() => {
    Promise.all([
      fetch(apiPath('/api/bills')).then(r => r.json()),
      fetch(apiPath('/api/credit-cards')).then(r => r.json()),
      fetch(apiPath('/api/settings')).then(r => r.json()),
      fetch(apiPath('/api/credit-cards/payment-summary')).then(r => r.json()),
      fetch(apiPath('/api/budget-vs-actual?months=2')).then(r => r.json()),
    ]).then(([billsData, cardsData, settingsData, ccSummary, budgetData]) => {
      setBills(Array.isArray(billsData) ? billsData : []);
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setSettings(settingsData);
      setCcPaymentSummary(ccSummary && typeof ccSummary === 'object' ? ccSummary : {});
      setBudgetComparison(
        Array.isArray(budgetData?.comparisons) ? (budgetData.comparisons.at(-1) ?? null) : null
      );
      // Load extra CC payment from DB, fallback to localStorage
      const dbExtra = settingsData?.extra_cc_payment ?? 0;
      const lsExtra = parseFloat(localStorage.getItem('budget_extra_payment') ?? '0') || 0;
      setExtraCCPayment(dbExtra > 0 ? dbExtra : lsExtra);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Nav />
        <main className="ml-56 flex-1 p-8 flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </main>
      </div>
    );
  }

  // Normalize all bills to monthly equivalents
  const totalBills = bills.reduce((sum, b) => sum + normalizeToMonthly(b.amount, b.frequency || 'monthly'), 0);
  const paidBills = bills.filter(b => b.status === 'paid');
  const totalPaid = paidBills.reduce((sum, b) => sum + (b.amount_paid ?? b.amount), 0);
  const remaining = totalBills - totalPaid;

  const paychecksPerMonth = settings ? getPaychecksPerMonth(settings.pay_cycle) : 2.17;
  const perPaycheck = totalBills / paychecksPerMonth;

  let nextPaycheck: Date | null = null;
  let daysToPaycheck = 0;
  if (settings?.last_paycheck_date) {
    nextPaycheck = getNextPaycheckDate(settings.pay_cycle, settings.last_paycheck_date);
    daysToPaycheck = daysUntil(nextPaycheck);
  }

  // Build upcoming CC items from due_day (cards with balance and minimum payment)
  function getNextCCDueDate(dueDay: number): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let d = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    return d;
  }

  const upcomingCCItems = cards
    .filter(c => c.balance > 0 && c.minimum_payment > 0 && c.due_day > 0)
    .filter(c => !ccPaymentSummary[c.id]?.paid)
    .filter(c => {
      const days = daysUntil(getNextCCDueDate(c.due_day));
      return days >= 0 && days <= 14;
    });

  const upcomingBills = bills.filter(b => {
    if (b.status === 'paid') return false;
    const dueDate = getNextDueDate(b);
    if (!dueDate) return false;
    const days = daysUntil(dueDate);
    return days >= 0 && days <= 14;
  }).sort((a, b) => {
    const da = getNextDueDate(a);
    const db = getNextDueDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });

  const totalDebt = cards.reduce((sum, c) => sum + c.balance, 0);
  const totalMinimums = cards.reduce((sum, c) => sum + c.minimum_payment, 0);
  const topCard = [...cards].filter(c => c.balance > 0).sort((a, b) => b.apr - a.apr)[0] ?? null;

  // Runway calculator
  const monthlyExpenses = totalBills + totalMinimums;
  const currentSavings = settings?.current_savings ?? 0;
  const currentRunway = monthlyExpenses > 0 ? currentSavings / monthlyExpenses : 0;
  const targetAmount = monthlyExpenses * targetMonths;
  const progressPct = Math.min(100, targetAmount > 0 ? (currentSavings / targetAmount) * 100 : 0);
  const runwayColor = currentRunway >= 6 ? 'text-green-400' : currentRunway >= 3 ? 'text-yellow-400' : 'text-red-400';
  const barColor = currentRunway >= 6 ? 'bg-green-500' : currentRunway >= 3 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="ml-56 flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 mt-1">
              {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Monthly Bills</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalBills)}</p>
              <p className="text-gray-600 text-xs mt-0.5">normalized to monthly</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Remaining</p>
              <p className={`text-2xl font-bold ${remaining > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{formatCurrency(remaining)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Per Paycheck</p>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(perPaycheck)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Paycheck Info */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-base font-semibold text-white mb-4">Pay Cycle</h2>
              {settings?.last_paycheck_date ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Pay cycle</span>
                    <span className="text-white text-sm capitalize">{settings.pay_cycle.replace('-', ' ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Next paycheck</span>
                    <span className="text-white text-sm">
                      {nextPaycheck?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Days until payday</span>
                    <span className={`text-sm font-semibold ${daysToPaycheck <= 3 ? 'text-green-400' : 'text-blue-400'}`}>
                      {daysToPaycheck} {daysToPaycheck === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-400 text-sm">Set aside per paycheck</span>
                    <span className="text-blue-400 text-base font-bold">{formatCurrency(perPaycheck)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Configure your pay cycle in{' '}
                  <a href="/settings" className="text-blue-400 hover:underline">Settings</a>.
                </p>
              )}
            </div>

            {/* Credit Card Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-base font-semibold text-white mb-4">Credit Card Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total debt</span>
                  <span className="text-red-400 text-sm font-semibold">{formatCurrency(totalDebt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total minimums / mo</span>
                  <span className="text-white text-sm">{formatCurrency(totalMinimums)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Cards tracked</span>
                  <span className="text-white text-sm">{cards.length}</span>
                </div>
                {topCard && (
                  <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 mt-2">
                    <p className="text-blue-400 text-xs font-semibold uppercase tracking-wide mb-1">Attack First - Avalanche</p>
                    <p className="text-white text-sm font-medium">{topCard.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {formatCurrency(topCard.balance)} balance - {topCard.apr}% APR
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">This Month vs Plan</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Budget health for {budgetComparison?.label ?? 'the current month'}.
                </p>
              </div>
              <a
                href="/budget"
                className="inline-flex items-center rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/15"
              >
                Open budget view
              </a>
            </div>

            {budgetComparison ? (
              <>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Review Status</p>
                    <p className={`mt-2 text-xl font-bold ${
                      budgetComparison.monthStatus === 'closed' ? 'text-emerald-300' : 'text-amber-300'
                    }`}>
                      {budgetComparison.monthStatus === 'closed' ? 'Closed' : 'Open'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {budgetComparison.closedAt
                        ? `Closed on ${new Date(budgetComparison.closedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : 'Still in active review on the calendar page.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Total Plan</p>
                    <p className="mt-2 text-xl font-bold text-white">
                      {budgetComparison.plannedTotal === null
                        ? 'No budget'
                        : formatCurrency(budgetComparison.plannedTotal)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {budgetComparison.budget
                        ? 'Combined target for the month.'
                        : 'Create a budget to unlock this panel.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Actual Activity</p>
                    <p className="mt-2 text-xl font-bold text-cyan-300">
                      {formatCurrency(budgetComparison.actualTotal)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Total booked across bills, disposable, savings, and extra debt.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Disposable</p>
                    <p className={`mt-2 text-xl font-bold ${budgetVarianceTone('spending', budgetComparison.variances.disposable)}`}>
                      {Math.abs(budgetComparison.variances.disposable) < 0.01
                        ? 'On target'
                        : budgetComparison.variances.disposable > 0
                          ? `${formatCurrency(budgetComparison.variances.disposable)} over`
                          : `${formatCurrency(Math.abs(budgetComparison.variances.disposable))} under`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Actual {formatCurrency(budgetComparison.actuals.disposable)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Savings Goal</p>
                    <p className={`mt-2 text-xl font-bold ${budgetVarianceTone('goal', budgetComparison.variances.savings)}`}>
                      {Math.abs(budgetComparison.variances.savings) < 0.01
                        ? 'On target'
                        : budgetComparison.variances.savings >= 0
                          ? `${formatCurrency(budgetComparison.variances.savings)} ahead`
                          : `${formatCurrency(Math.abs(budgetComparison.variances.savings))} short`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Actual {formatCurrency(budgetComparison.actuals.savings)}
                    </p>
                  </div>
                </div>

                {budgetComparison.insights?.length ? (
                  <div className="mt-4 rounded-lg border border-gray-800 bg-gray-800/25 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Budget Pulse</p>
                    <p className="mt-2 text-sm text-gray-300">{budgetComparison.insights[0]}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                No budget comparison is available yet. Save a monthly budget to start seeing plan-vs-actual progress here.
              </p>
            )}
          </div>

          {/* Leftover Calculator */}
          {settings && settings.monthly_income > 0 && (() => {
            const paycheckAmount = settings.monthly_income; // stored as per-paycheck amount
            const monthlyIncome = paycheckAmount * paychecksPerMonth;
            const totalObligations = totalBills + totalMinimums + extraCCPayment;
            const leftoverMonthly = monthlyIncome - totalObligations;
            const billsPerPaycheck = totalObligations / paychecksPerMonth;
            const leftoverPerPaycheck = paycheckAmount - billsPerPaycheck;
            // Recommended extra CC: 20% of leftover monthly, rounded to nearest $5, min $0
            const recommendedExtra = totalMinimums > 0
              ? Math.max(0, Math.round((leftoverMonthly * 0.20) / 5) * 5)
              : 0;
            return (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
                <h2 className="text-base font-semibold text-white mb-4">Take-Home Breakdown</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Monthly</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Monthly income <span className="text-gray-600 text-xs">(paycheck x {paychecksPerMonth.toFixed(2)})</span></span>
                        <span className="text-white text-sm font-medium">{formatCurrency(monthlyIncome)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Bills + minimums{extraCCPayment > 0 ? ` + ${formatCurrency(extraCCPayment)} extra CC` : ''}</span>
                        <span className="text-red-400 text-sm">-{formatCurrency(totalObligations)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                        <span className="text-gray-300 text-sm font-medium">Leftover after bills</span>
                        <span className={`text-sm font-bold ${leftoverMonthly >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(leftoverMonthly)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Per Paycheck</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Paycheck amount</span>
                        <span className="text-white text-sm font-medium">{formatCurrency(paycheckAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Bills per paycheck</span>
                        <span className="text-red-400 text-sm">-{formatCurrency(billsPerPaycheck)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                        <span className="text-gray-300 text-sm font-medium">Left in pocket</span>
                        <span className={`text-sm font-bold ${leftoverPerPaycheck >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(leftoverPerPaycheck)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              {/* Extra CC Payment */}
              {totalMinimums > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">Extra CC Payment / mo</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Recommended: <button
                          onClick={() => saveExtraCC(recommendedExtra)}
                          className="text-blue-400 hover:text-blue-300 underline"
                        >{formatCurrency(recommendedExtra)}</button>
                        <span className="text-gray-600 ml-1">(20% of leftover)</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={extraCCPayment || ''}
                        onChange={e => saveExtraCC(parseFloat(e.target.value) || 0)}
                        className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {extraCCPayment > 0 && (
                    <p className="text-xs text-gray-600">
                      Left after extra payment: <span className={`font-medium ${leftoverMonthly >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(leftoverMonthly)}</span> / mo
                    </p>
                  )}
                </div>
              )}
            </div>
            );
          })()}


          {/* Runway Calculator */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h2 className="text-base font-semibold text-white mb-4">Emergency Fund Runway</h2>
            {monthlyExpenses > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Current savings</p>
                    <p className="text-base font-bold text-white">{formatCurrency(currentSavings)}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Monthly expenses</p>
                    <p className="text-base font-bold text-white">{formatCurrency(monthlyExpenses)}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Current runway</p>
                    <p className={`text-base font-bold ${runwayColor}`}>{currentRunway.toFixed(1)} months</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">
                      Target: <span className="text-white font-medium">{targetMonths} months</span>
                    </label>
                    <span className="text-sm text-gray-400">
                      To cover {targetMonths} months:{' '}
                      <span className="text-white font-medium">{formatCurrency(targetAmount)}</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={targetMonths}
                    onChange={e => setTargetMonths(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>1 mo</span><span>6 mo</span><span>12 mo</span><span>24 mo</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>{formatCurrency(currentSavings)} saved</span>
                    <span>{progressPct.toFixed(0)}% of {targetMonths}-month goal</span>
                    <span>{formatCurrency(targetAmount)} goal</span>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  {currentSavings < targetAmount ? (
                    <p className="text-xs text-gray-500 mt-2">
                      {formatCurrency(targetAmount - currentSavings)} more needed to reach your {targetMonths}-month runway
                    </p>
                  ) : (
                    <p className="text-xs text-green-400 mt-2">
                      Goal reached - you have {currentRunway.toFixed(1)} months of runway
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm">
                Add bills and credit cards to calculate runway. Set your savings in{' '}
                <a href="/settings" className="text-blue-400 hover:underline">Settings</a>.
              </p>
            )}
          </div>

          {/* Upcoming Bills */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h2 className="text-base font-semibold text-white mb-4">
              Upcoming Bills
              <span className="text-gray-500 text-sm font-normal ml-2">(next 14 days, unpaid)</span>
            </h2>
            {upcomingBills.length === 0 && upcomingCCItems.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming unpaid bills in the next 14 days.</p>
            ) : (
              <div className="space-y-2">
                {upcomingBills.map(bill => {
                  const dueDate = getNextDueDate(bill)!;
                  const days = daysUntil(dueDate);
                  const isSoon = days <= 3;

                  return (
                    <div key={`bill-${bill.id}`} className="flex items-center justify-between py-2.5 px-3 bg-gray-800/50 rounded-lg">
                      <div>
                        <p className="text-white text-sm font-medium">{bill.name}</p>
                        <p className="text-gray-500 text-xs">{bill.category}</p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-white text-sm font-medium">{formatCurrency(bill.amount)}</p>
                          <p className={`text-xs ${isSoon ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {days === 0 ? 'Due today' : `Due in ${days}d`}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          bill.status === 'pending' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {bill.status || 'unpaid'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {upcomingCCItems.map(card => {
                  const dueDate = getNextCCDueDate(card.due_day);
                  const days = daysUntil(dueDate);
                  const isSoon = days <= 3;

                  return (
                    <div key={`cc-${card.id}`} className="flex items-center justify-between py-2.5 px-3 bg-gray-800/50 rounded-lg">
                      <div>
                        <p className="text-white text-sm font-medium">{card.name}</p>
                        <p className="text-gray-500 text-xs">Credit Card - min payment</p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-white text-sm font-medium">{formatCurrency(card.minimum_payment)}</p>
                          <p className={`text-xs ${isSoon ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {days === 0 ? 'Due today' : `Due in ${days}d`}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-900/40 text-blue-400">
                          unpaid
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bills Progress */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-4">Monthly Progress</h2>
            <div className="space-y-1">
              {bills.map(bill => {
                const monthlyAmt = normalizeToMonthly(bill.amount, bill.frequency || 'monthly');
                return (
                  <div key={`bill-${bill.id}`} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        bill.status === 'paid' ? 'bg-green-400' :
                        bill.status === 'pending' ? 'bg-yellow-400' :
                        'bg-gray-600'
                      }`} />
                      <span className="text-sm text-gray-300">{bill.name}</span>
                      {bill.is_autopay === 1 && (
                        <span className="text-xs text-gray-600 italic">auto</span>
                      )}
                      {bill.frequency && bill.frequency !== 'monthly' && (
                        <span className="text-xs text-gray-600 capitalize">{bill.frequency}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{formatCurrency(monthlyAmt)}/mo</span>
                      <span className={`text-xs w-14 text-right ${
                        bill.status === 'paid' ? 'text-green-400' :
                        bill.status === 'pending' ? 'text-yellow-400' :
                        'text-gray-600'
                      }`}>
                        {bill.status || 'unpaid'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
              {cards.filter(c => c.balance > 0 && c.minimum_payment > 0).map(card => {
                const ccPaid = ccPaymentSummary[card.id]?.paid ?? false;
                return (
                  <div key={`cc-${card.id}`} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ccPaid ? 'bg-green-400' : 'bg-blue-500'}`} />
                      <span className="text-sm text-gray-300">{card.name}</span>
                      <span className="text-xs text-blue-500 italic">CC min</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{formatCurrency(card.minimum_payment)}/mo</span>
                      <span className={`text-xs w-14 text-right ${ccPaid ? 'text-green-400' : 'text-gray-600'}`}>
                        {ccPaid ? 'paid' : 'unpaid'}
                      </span>
                    </div>
                  </div>
                );
              })}
            <div className="mt-4 pt-3 border-t border-gray-800">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{paidBills.length} of {bills.length} bills paid</span>
                <span>{Math.round((totalPaid / totalBills) * 100) || 0}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (totalPaid / totalBills) * 100) || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
