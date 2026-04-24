'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { getErrorMessage } from '@/lib/client/errors';
import {
  getBudgetVsActual,
  saveMonthlyBudget,
  type BudgetComparison,
  type BudgetVsActualResponse,
} from '@/lib/client/budget-client';
import { useProtectedRoute } from '@/lib/client/use-protected-route';

type MetricKey = 'bills' | 'disposable' | 'savings' | 'extraDebt';

const metricCards = [
  {
    key: 'bills' as const,
    title: 'Bills + Minimums',
    accentClass: 'text-blue-300',
    panelClass: 'border-blue-500/20 bg-blue-500/10',
    helper: 'Required bills plus credit-card minimum payments covered this month.',
  },
  {
    key: 'disposable' as const,
    title: 'Disposable Spend',
    accentClass: 'text-amber-300',
    panelClass: 'border-amber-500/20 bg-amber-500/10',
    helper: 'Outflow tagged as discretionary spending from your cash buckets.',
  },
  {
    key: 'savings' as const,
    title: 'Savings',
    accentClass: 'text-emerald-300',
    panelClass: 'border-emerald-500/20 bg-emerald-500/10',
    helper: 'Inflow recorded into savings accounts during the month.',
  },
  {
    key: 'extraDebt' as const,
    title: 'Extra Debt Paydown',
    accentClass: 'text-cyan-300',
    panelClass: 'border-cyan-500/20 bg-cyan-500/10',
    helper: "Credit-card payments above each card's minimum payment.",
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function varianceText(metric: MetricKey, variance: number) {
  if (Math.abs(variance) < 0.01) {
    return {
      label: 'On target',
      className: 'text-gray-300',
    };
  }

  const goalMetric = metric === 'savings' || metric === 'extraDebt';
  const isGood = goalMetric ? variance > 0 : variance < 0;

  if (variance > 0) {
    return {
      label: goalMetric
        ? `${formatCurrency(variance)} ahead`
        : `${formatCurrency(variance)} over`,
      className: isGood ? 'text-emerald-300' : 'text-red-300',
    };
  }

  return {
    label: goalMetric
      ? `${formatCurrency(Math.abs(variance))} short`
      : `${formatCurrency(Math.abs(variance))} under`,
    className: isGood ? 'text-emerald-300' : 'text-red-300',
  };
}

function targetAmount(comparison: BudgetComparison, metric: MetricKey) {
  if (!comparison.budget) {
    return null;
  }

  if (metric === 'bills') return comparison.budget.bills_budget;
  if (metric === 'disposable') return comparison.budget.disposable_budget;
  if (metric === 'savings') return comparison.budget.savings_target;
  return comparison.budget.extra_debt_payment_target;
}

function actualAmount(comparison: BudgetComparison, metric: MetricKey) {
  if (metric === 'bills') return comparison.actuals.bills;
  if (metric === 'disposable') return comparison.actuals.disposable;
  if (metric === 'savings') return comparison.actuals.savings;
  return comparison.actuals.extraDebt;
}

function varianceAmount(comparison: BudgetComparison, metric: MetricKey) {
  if (metric === 'bills') return comparison.variances.bills;
  if (metric === 'disposable') return comparison.variances.disposable;
  if (metric === 'savings') return comparison.variances.savings;
  return comparison.variances.extraDebt;
}

function metricProgress(comparison: BudgetComparison, metric: MetricKey) {
  const target = targetAmount(comparison, metric);
  if (target === null) {
    return null;
  }

  if (target <= 0) {
    return actualAmount(comparison, metric) > 0 ? 100 : 0;
  }

  return Math.max(0, Math.min(100, (actualAmount(comparison, metric) / target) * 100));
}

function historyBadge(comparison: BudgetComparison) {
  if (!comparison.budget) {
    return {
      label: 'No budget',
      className: 'bg-gray-800 text-gray-400',
    };
  }

  const positiveCount = metricCards.filter((metric) => {
    const state = varianceText(metric.key, varianceAmount(comparison, metric.key));
    return state.className.includes('emerald') || state.label === 'On target';
  }).length;

  if (positiveCount >= 3) {
    return {
      label: 'Strong month',
      className: 'bg-emerald-500/15 text-emerald-300',
    };
  }

  if (positiveCount >= 2) {
    return {
      label: 'Mixed month',
      className: 'bg-amber-500/15 text-amber-300',
    };
  }

  return {
    label: 'Needs attention',
    className: 'bg-red-500/15 text-red-300',
  };
}

function reviewBadge(comparison: BudgetComparison) {
  if (comparison.monthStatus === 'closed') {
    return {
      label: 'Closed',
      className: 'bg-emerald-500/15 text-emerald-300',
    };
  }

  return {
    label: 'Open',
    className: 'bg-amber-500/15 text-amber-300',
  };
}

function fieldValue(
  comparison: BudgetComparison | null | undefined,
  key: keyof NonNullable<BudgetComparison['budget']>
) {
  if (!comparison?.budget) {
    return '';
  }

  const value = comparison.budget[key];
  return typeof value === 'number' ? String(value) : '';
}

export default function BudgetPage() {
  const { checkingAuth, authError } = useProtectedRoute();
  const [months, setMonths] = useState<6 | 12>(6);
  const [data, setData] = useState<BudgetVsActualResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    bills_budget: '',
    disposable_budget: '',
    savings_target: '',
    extra_debt_payment_target: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadBudgetView() {
      setLoading(true);
      setError('');

      try {
        const payload = await getBudgetVsActual(months);
        if (cancelled) {
          return;
        }

        setData(payload);
        setSelectedMonth((current) => {
          if (payload.comparisons.some((comparison) => comparison.month === current)) {
            return current;
          }

          return payload.comparisons.at(-1)?.month ?? '';
        });
      } catch (fetchError) {
        if (!cancelled) {
          setError(getErrorMessage(fetchError, 'Failed to load budget view.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (!checkingAuth && !authError) {
      void loadBudgetView();
    }

    return () => {
      cancelled = true;
    };
  }, [authError, checkingAuth, months]);

  const selectedComparison =
    data?.comparisons.find((comparison) => comparison.month === selectedMonth) ??
    data?.comparisons.at(-1) ??
    null;
  const selectedIndex =
    data?.comparisons.findIndex(
      (comparison) => comparison.month === selectedComparison?.month
    ) ?? -1;
  const previousBudgetComparison =
    selectedIndex > 0
      ? [...(data?.comparisons.slice(0, selectedIndex) ?? [])]
          .reverse()
          .find((comparison) => comparison.budget)
      : null;
  const metricStatusCount = selectedComparison
    ? metricCards.filter((metric) => {
        const state = varianceText(
          metric.key,
          varianceAmount(selectedComparison, metric.key)
        );
        return state.className.includes('emerald') || state.label === 'On target';
      }).length
    : 0;
  const currentBadge = selectedComparison ? historyBadge(selectedComparison) : null;
  const currentReviewBadge = selectedComparison ? reviewBadge(selectedComparison) : null;

  useEffect(() => {
    setForm({
      bills_budget: fieldValue(selectedComparison, 'bills_budget'),
      disposable_budget: fieldValue(selectedComparison, 'disposable_budget'),
      savings_target: fieldValue(selectedComparison, 'savings_target'),
      extra_debt_payment_target: fieldValue(
        selectedComparison,
        'extra_debt_payment_target'
      ),
    });
  }, [selectedComparison]);

  async function refreshBudgetView(preferredMonth?: string) {
    const payload = await getBudgetVsActual(months);
    setData(payload);
    setSelectedMonth((current) => {
      const next = preferredMonth ?? current;
      if (payload.comparisons.some((comparison) => comparison.month === next)) {
        return next;
      }

      return payload.comparisons.at(-1)?.month ?? '';
    });
  }

  async function saveBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedComparison) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const body = {
        year: selectedComparison.year,
        month: selectedComparison.monthNumber,
        bills_budget: parseFloat(form.bills_budget || '0'),
        disposable_budget: parseFloat(form.disposable_budget || '0'),
        savings_target: parseFloat(form.savings_target || '0'),
        extra_debt_payment_target: parseFloat(form.extra_debt_payment_target || '0'),
      };

      await saveMonthlyBudget(body, selectedComparison.budget?.id);
      await refreshBudgetView(selectedComparison.month);
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Failed to save budget.'));
    } finally {
      setSaving(false);
    }
  }

  function copyPreviousBudget() {
    if (!previousBudgetComparison?.budget) {
      return;
    }

    setForm({
      bills_budget: String(previousBudgetComparison.budget.bills_budget),
      disposable_budget: String(previousBudgetComparison.budget.disposable_budget),
      savings_target: String(previousBudgetComparison.budget.savings_target),
      extra_debt_payment_target: String(
        previousBudgetComparison.budget.extra_debt_payment_target
      ),
    });
  }

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Budget vs Actual</h1>
              <p className="mt-1 text-gray-400">
                Set monthly targets, compare them to actual outcomes, and spot where the
                month drifted.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-gray-800 bg-gray-900 p-1">
              {[6, 12].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMonths(value as 6 | 12)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    months === value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Last {value} Months
                </button>
              ))}
            </div>
          </div>

          {authError || error ? (
            <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {authError || error}
            </div>
          ) : null}

          {checkingAuth || loading || !data ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center text-gray-400">
              {checkingAuth ? 'Checking session...' : 'Loading budget view...'}
            </div>
          ) : (
            <>
              <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Month Selector</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Choose a month to edit targets and inspect the budget variance.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {data.comparisons.length} month{data.comparisons.length === 1 ? '' : 's'}{' '}
                    loaded
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.comparisons.map((comparison) => (
                    <button
                      key={comparison.month}
                      type="button"
                      onClick={() => setSelectedMonth(comparison.month)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        selectedComparison?.month === comparison.month
                          ? 'border-blue-500 bg-blue-500/15 text-white'
                          : 'border-gray-800 bg-gray-800/40 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="font-medium">{comparison.label}</div>
                      <div className="mt-1 text-xs">
                        {comparison.budget ? 'Budget saved' : 'No target yet'} /{' '}
                        {comparison.monthStatus === 'closed' ? 'Closed' : 'Open'}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {selectedComparison ? (
                <>
                  <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <form
                      onSubmit={saveBudget}
                      className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h2 className="text-base font-semibold text-white">
                            Monthly Budget Editor
                          </h2>
                          <p className="mt-1 text-xs text-gray-500">
                            Planning targets for {selectedComparison.label}.
                          </p>
                        </div>
                        <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
                          {selectedComparison.budget
                            ? 'Updating existing budget'
                            : 'Creating new budget'}
                        </span>
                      </div>

                      {!selectedComparison.budget && previousBudgetComparison?.budget ? (
                        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              Start from {previousBudgetComparison.label}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              Pull forward the last saved target set, then adjust what
                              changed.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={copyPreviousBudget}
                            className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800"
                          >
                            Copy Targets
                          </button>
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-gray-300">Bills Budget</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.bills_budget}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                bills_budget: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                            placeholder="0.00"
                          />
                          <p className="text-xs text-gray-500">
                            Include recurring bills and card minimums here.
                          </p>
                        </label>

                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-gray-300">
                            Disposable Budget
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.disposable_budget}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                disposable_budget: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                            placeholder="0.00"
                          />
                          <p className="text-xs text-gray-500">
                            Your flexible spending cap for the month.
                          </p>
                        </label>

                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-gray-300">
                            Savings Target
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.savings_target}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                savings_target: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                            placeholder="0.00"
                          />
                          <p className="text-xs text-gray-500">
                            Shortfalls stay separate from spending overages.
                          </p>
                        </label>

                        <label className="space-y-1.5">
                          <span className="text-sm font-medium text-gray-300">
                            Extra Debt Payment Target
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.extra_debt_payment_target}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                extra_debt_payment_target: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white"
                            placeholder="0.00"
                          />
                          <p className="text-xs text-gray-500">
                            Payments above each card&apos;s minimum payment.
                          </p>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {saving
                          ? 'Saving...'
                          : selectedComparison.budget
                            ? 'Save Targets'
                            : 'Create Targets'}
                      </button>
                    </form>

                    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                      <h2 className="text-base font-semibold text-white">Month Snapshot</h2>
                      <p className="mt-1 text-xs text-gray-500">
                        High-level view for {selectedComparison.label}.
                      </p>

                      <div className="mt-4 rounded-xl border border-gray-800 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-950 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Budget Health
                            </p>
                            <p className="mt-2 text-xl font-semibold text-white">
                              {selectedComparison.budget
                                ? `${metricStatusCount} of ${metricCards.length} areas on track`
                                : 'No targets saved yet'}
                            </p>
                            <p className="mt-1 text-sm text-gray-400">
                              {selectedComparison.budget
                                ? 'Bills and disposable spending flag overruns, while savings and extra debt track shortfalls against goal.'
                                : 'Save a target set for this month to unlock planning feedback.'}
                            </p>
                          </div>
                          {currentBadge ? (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${currentBadge.className}`}
                            >
                              {currentBadge.label}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Review Status
                            </p>
                            {currentReviewBadge ? (
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${currentReviewBadge.className}`}
                              >
                                {currentReviewBadge.label}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-2xl font-bold text-white">
                            {selectedComparison.monthStatus === 'closed'
                              ? 'Trusted Month'
                              : 'Still Open'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {selectedComparison.closedAt
                              ? `Closed on ${new Date(selectedComparison.closedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}`
                              : 'Review is still in progress on the calendar page.'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Planned Total
                          </p>
                          <p className="mt-2 text-2xl font-bold text-white">
                            {selectedComparison.plannedTotal === null
                              ? 'No budget set'
                              : formatCurrency(selectedComparison.plannedTotal)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Bills, disposable, savings, and extra debt targets.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Actual Total
                        </p>
                        <p className="mt-2 text-2xl font-bold text-cyan-300">
                          {formatCurrency(selectedComparison.actualTotal)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Total actual activity across the same four buckets.
                        </p>
                      </div>

                      <div className="mt-4 rounded-lg border border-gray-800 bg-gray-800/20 p-4">
                        <p className="text-sm text-gray-300">
                          {selectedComparison.budget
                            ? `This month is ${
                                selectedComparison.actualTotal >
                                (selectedComparison.plannedTotal ?? 0)
                                  ? 'running above'
                                  : selectedComparison.actualTotal <
                                      (selectedComparison.plannedTotal ?? 0)
                                    ? 'running below'
                                    : 'matching'
                              } the total plan by ${
                                selectedComparison.plannedTotal === null
                                  ? '$0'
                                  : formatCurrency(
                                      Math.abs(
                                        selectedComparison.actualTotal -
                                          selectedComparison.plannedTotal
                                      )
                                    )
                              }.`
                            : 'Save a budget for this month to unlock total plan variance.'}
                        </p>
                      </div>
                    </section>
                  </div>

                  <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {metricCards.map((metric) => {
                      const target = targetAmount(selectedComparison, metric.key);
                      const actual = actualAmount(selectedComparison, metric.key);
                      const variance = varianceAmount(selectedComparison, metric.key);
                      const progress = metricProgress(selectedComparison, metric.key);
                      const varianceState = varianceText(metric.key, variance);

                      return (
                        <section
                          key={metric.key}
                          className={`rounded-xl border p-4 ${metric.panelClass}`}
                        >
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {metric.title}
                          </p>
                          <p className={`mt-2 text-2xl font-bold ${metric.accentClass}`}>
                            {formatCurrency(actual)}
                          </p>
                          <p className="mt-1 text-sm text-gray-400">
                            {target === null
                              ? 'No target set yet'
                              : `Target ${formatCurrency(target)}`}
                          </p>
                          <p className={`mt-3 text-sm font-medium ${varianceState.className}`}>
                            {target === null
                              ? 'Save a target to see variance'
                              : varianceState.label}
                          </p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800/80">
                            <div
                              className={`h-full rounded-full ${
                                metric.key === 'bills'
                                  ? 'bg-blue-400'
                                  : metric.key === 'disposable'
                                    ? 'bg-amber-400'
                                    : metric.key === 'savings'
                                      ? 'bg-emerald-400'
                                      : 'bg-cyan-400'
                              }`}
                              style={{ width: `${progress ?? 0}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] text-gray-500">
                            {target === null
                              ? 'Progress appears after a target is saved.'
                              : `${Math.round(progress ?? 0)}% of target booked so far.`}
                          </p>
                          <p className="mt-2 text-xs text-gray-500">{metric.helper}</p>
                        </section>
                      );
                    })}
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                      <h2 className="text-base font-semibold text-white">Variance Summary</h2>
                      <p className="mt-1 text-xs text-gray-500">
                        Category-by-category comparison for {selectedComparison.label}.
                      </p>
                      <div className="mt-4 space-y-3">
                        {metricCards.map((metric) => {
                          const variance = varianceAmount(selectedComparison, metric.key);
                          const state = varianceText(metric.key, variance);

                          return (
                            <div
                              key={`summary-${metric.key}`}
                              className="rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <p className="text-sm font-medium text-white">{metric.title}</p>
                                <p className={`text-sm font-medium ${state.className}`}>
                                  {selectedComparison.budget ? state.label : 'No target'}
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-gray-500">{metric.helper}</p>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                      <h2 className="text-base font-semibold text-white">
                        What Changed This Month
                      </h2>
                      <p className="mt-1 text-xs text-gray-500">
                        A quick read on the biggest shifts and gaps.
                      </p>
                      <div className="mt-4 space-y-3">
                        {selectedComparison.insights.map((insight, index) => (
                          <div
                            key={`${selectedComparison.month}-insight-${index}`}
                            className="rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3 text-sm text-gray-300"
                          >
                            {insight}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <section className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-5">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-white">
                          Recent Month History
                        </h2>
                        <p className="mt-1 text-xs text-gray-500">
                          A compact look across the loaded window so you can spot drift month
                          to month.
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">{months}-month planning window</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px]">
                        <thead>
                          <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-3 font-medium">Month</th>
                            <th className="px-3 py-3 font-medium">Review</th>
                            <th className="px-3 py-3 font-medium">Status</th>
                            <th className="px-3 py-3 font-medium">Plan</th>
                            <th className="px-3 py-3 font-medium">Actual</th>
                            <th className="px-3 py-3 font-medium">Disposable</th>
                            <th className="px-3 py-3 font-medium">Savings</th>
                            <th className="px-3 py-3 font-medium">Extra Debt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...data.comparisons].reverse().map((comparison) => {
                            const badge = historyBadge(comparison);
                            const review = reviewBadge(comparison);
                            const disposableState = varianceText(
                              'disposable',
                              varianceAmount(comparison, 'disposable')
                            );
                            const savingsState = varianceText(
                              'savings',
                              varianceAmount(comparison, 'savings')
                            );
                            const debtState = varianceText(
                              'extraDebt',
                              varianceAmount(comparison, 'extraDebt')
                            );

                            return (
                              <tr
                                key={`history-${comparison.month}`}
                                className={`border-b border-gray-800/70 text-sm ${
                                  comparison.month === selectedComparison.month
                                    ? 'bg-blue-500/10'
                                    : 'bg-transparent'
                                }`}
                              >
                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMonth(comparison.month)}
                                    className="text-left text-white hover:text-blue-300"
                                  >
                                    {comparison.label}
                                  </button>
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${review.className}`}
                                  >
                                    {review.label}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-gray-300">
                                  {comparison.plannedTotal === null
                                    ? 'No budget'
                                    : formatCurrency(comparison.plannedTotal)}
                                </td>
                                <td className="px-3 py-3 text-white">
                                  {formatCurrency(comparison.actualTotal)}
                                </td>
                                <td className={`px-3 py-3 ${disposableState.className}`}>
                                  {comparison.budget ? disposableState.label : 'No target'}
                                </td>
                                <td className={`px-3 py-3 ${savingsState.className}`}>
                                  {comparison.budget ? savingsState.label : 'No target'}
                                </td>
                                <td className={`px-3 py-3 ${debtState.className}`}>
                                  {comparison.budget ? debtState.label : 'No target'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
