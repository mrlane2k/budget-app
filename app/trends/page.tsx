'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { getErrorMessage } from '@/lib/client/errors';
import { getMonthlyTrends, type TrendPoint, type TrendsResponse } from '@/lib/client/trends-client';
import { useProtectedRoute } from '@/lib/client/use-protected-route';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function monthShortLabel(label: string) {
  return label.split(' ')[0] ?? label;
}

function currentValue(points: TrendPoint[]) {
  return points.at(-1)?.value ?? 0;
}

function previousValue(points: TrendPoint[]) {
  return points.at(-2)?.value ?? 0;
}

function deltaText(points: TrendPoint[]) {
  const current = currentValue(points);
  const previous = previousValue(points);
  const delta = current - previous;
  const direction = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  return {
    previous,
    delta,
    direction,
  };
}

function TrendSummaryCard({
  title,
  points,
  accentClass,
}: {
  title: string;
  points: TrendPoint[];
  accentClass: string;
}) {
  const current = currentValue(points);
  const { previous, delta, direction } = deltaText(points);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${accentClass}`}>{formatCurrency(current)}</p>
      <p className="mt-1 text-xs text-gray-500">
        Prev month {formatCurrency(previous)}
        <span
          className={`ml-2 font-medium ${
            direction === 'up'
              ? 'text-red-300'
              : direction === 'down'
                ? 'text-emerald-300'
                : 'text-gray-400'
          }`}
        >
          {delta === 0 ? 'No change' : `${delta > 0 ? '+' : '-'}${formatCurrency(Math.abs(delta))}`}
        </span>
      </p>
    </div>
  );
}

function TrendBars({
  title,
  subtitle,
  points,
  barClass,
}: {
  title: string;
  subtitle: string;
  points: TrendPoint[];
  barClass: string;
}) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        </div>
        <p className="text-sm font-medium text-gray-300">{formatCurrency(currentValue(points))}</p>
      </div>
      <div className="grid grid-cols-6 gap-3 md:grid-cols-12">
        {points.map((point) => (
          <div key={`${title}-${point.month}`} className="flex flex-col items-center gap-2">
            <div className="flex h-36 w-full items-end justify-center rounded-lg bg-gray-800/40 px-1 py-2">
              <div
                className={`w-full rounded-md ${barClass}`}
                style={{
                  height: `${Math.max(8, (point.value / maxValue) * 100)}%`,
                }}
                title={`${point.label}: ${formatCurrency(point.value)}`}
              />
            </div>
            <p className="text-[11px] text-gray-500">{monthShortLabel(point.label)}</p>
            <p className="text-[11px] text-gray-400">{formatCurrency(point.value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TrendsPage() {
  const { checkingAuth, authError } = useProtectedRoute();
  const [months, setMonths] = useState<6 | 12>(6);
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadTrends() {
      setLoading(true);
      setError('');

      try {
        const payload = await getMonthlyTrends(months);
        if (!cancelled) {
          setData(payload);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(getErrorMessage(fetchError, 'Failed to load trends.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (!checkingAuth && !authError) {
      void loadTrends();
    }

    return () => {
      cancelled = true;
    };
  }, [authError, checkingAuth, months]);

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Trends</h1>
              <p className="mt-1 text-gray-400">
                Month-over-month visibility for bills, disposable spending, savings, and card activity.
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
              {checkingAuth ? 'Checking session...' : 'Loading trends...'}
            </div>
          ) : (
            <>
              <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <TrendSummaryCard
                  title="Bills Paid"
                  points={data.billsPaidByMonth}
                  accentClass="text-blue-300"
                />
                <TrendSummaryCard
                  title="Disposable Spend"
                  points={data.disposableSpendingByMonth}
                  accentClass="text-amber-300"
                />
                <TrendSummaryCard
                  title="Savings Added"
                  points={data.savingsContributionsByMonth}
                  accentClass="text-emerald-300"
                />
                <TrendSummaryCard
                  title="Cash Outflow"
                  points={data.netOutflowByMonth}
                  accentClass="text-cyan-300"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <TrendBars
                  title="Bills Paid"
                  subtitle="Paid bill activity from monthly bill records."
                  points={data.billsPaidByMonth}
                  barClass="bg-blue-500"
                />
                <TrendBars
                  title="Disposable Spending"
                  subtitle="Outflow recorded against your discretionary bucket."
                  points={data.disposableSpendingByMonth}
                  barClass="bg-amber-500"
                />
                <TrendBars
                  title="Savings Contributions"
                  subtitle="Inflows recorded into savings accounts."
                  points={data.savingsContributionsByMonth}
                  barClass="bg-emerald-500"
                />
                <TrendBars
                  title="Credit Card Purchases"
                  subtitle="New card spending, separate from card payments."
                  points={data.creditCardPurchasesByMonth}
                  barClass="bg-violet-500"
                />
                <TrendBars
                  title="Credit Card Payments"
                  subtitle="Debt payoff activity applied to card balances."
                  points={data.creditCardPaymentsByMonth}
                  barClass="bg-sky-500"
                />
                <TrendBars
                  title="Credit Card Interest"
                  subtitle="Interest posted to card balances."
                  points={data.creditCardInterestByMonth}
                  barClass="bg-orange-500"
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
