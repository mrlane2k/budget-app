'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { getErrorMessage } from '@/lib/client/errors';
import {
  getCalendarMonth,
  saveMonthlyClose,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarResponse,
  type MonthlyClose,
} from '@/lib/client/calendar-client';
import { useProtectedRoute } from '@/lib/client/use-protected-route';

type CloseFormState = {
  bills_reviewed: boolean;
  transfers_reviewed: boolean;
  disposable_reviewed: boolean;
  credit_cards_reviewed: boolean;
  notes: string;
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const checklistItems: Array<{
  key: keyof Omit<CloseFormState, 'notes'>;
  label: string;
}> = [
  { key: 'bills_reviewed', label: 'Bills reviewed' },
  { key: 'transfers_reviewed', label: 'Transfers reviewed' },
  { key: 'disposable_reviewed', label: 'Disposable spending reviewed' },
  {
    key: 'credit_cards_reviewed',
    label: 'Card balances and payments reviewed',
  },
];

const eventTone: Record<
  CalendarEventType,
  { badgeClass: string; cardClass: string; label: string }
> = {
  bill_due: {
    badgeClass: 'bg-blue-500/15 text-blue-300',
    cardClass: 'border-blue-500/20 bg-blue-500/10',
    label: 'Bill due',
  },
  payday: {
    badgeClass: 'bg-emerald-500/15 text-emerald-300',
    cardClass: 'border-emerald-500/20 bg-emerald-500/10',
    label: 'Payday',
  },
  transfer: {
    badgeClass: 'bg-cyan-500/15 text-cyan-300',
    cardClass: 'border-cyan-500/20 bg-cyan-500/10',
    label: 'Transfer',
  },
  credit_card_due: {
    badgeClass: 'bg-amber-500/15 text-amber-300',
    cardClass: 'border-amber-500/20 bg-amber-500/10',
    label: 'Card due',
  },
  savings_contribution: {
    badgeClass: 'bg-violet-500/15 text-violet-300',
    cardClass: 'border-violet-500/20 bg-violet-500/10',
    label: 'Savings',
  },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftMonth(year: number, month: number, offset: number) {
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
  };
}

function buildCalendarDays(year: number, month: number) {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(firstOfMonth);
  start.setUTCDate(start.getUTCDate() - firstOfMonth.getUTCDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);

    return {
      key: isoDate(day),
      date: day,
      inMonth: day.getUTCMonth() === month - 1,
    };
  });
}

function buildCloseForm(close: MonthlyClose | null): CloseFormState {
  return {
    bills_reviewed: close?.bills_reviewed ?? false,
    transfers_reviewed: close?.transfers_reviewed ?? false,
    disposable_reviewed: close?.disposable_reviewed ?? false,
    credit_cards_reviewed: close?.credit_cards_reviewed ?? false,
    notes: close?.notes ?? '',
  };
}

function getPreferredSelectedDate(payload: CalendarResponse) {
  const monthPrefix = `${payload.year}-${String(payload.month).padStart(2, '0')}`;
  const todayKey = isoDate(new Date());

  if (todayKey.startsWith(monthPrefix)) {
    return todayKey;
  }

  const firstEventInMonth = payload.events.find((event) =>
    event.date.startsWith(monthPrefix)
  );

  return firstEventInMonth?.date ?? `${monthPrefix}-01`;
}

function statusLabel(status: string | null) {
  if (!status) {
    return null;
  }

  if (status === 'paid') return 'Paid';
  if (status === 'partial') return 'Partial';
  if (status === 'due') return 'Due';
  if (status === 'expected') return 'Expected';
  if (status === 'recorded') return 'Recorded';
  if (status === 'pending') return 'Pending';
  if (status === 'scheduled') return 'Scheduled';
  return status;
}

export default function CalendarPage() {
  const { checkingAuth, authError } = useProtectedRoute();
  const initialDate = new Date();
  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth() + 1);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [closeForm, setCloseForm] = useState<CloseFormState>(buildCloseForm(null));
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      setLoading(true);
      setError('');

      try {
        const payload = await getCalendarMonth({ year, month });
        if (cancelled) {
          return;
        }

        setData(payload);
        setCloseForm(buildCloseForm(payload.close));
        setSelectedDate((current) => {
          if (current.startsWith(`${payload.year}-${String(payload.month).padStart(2, '0')}`)) {
            return current;
          }

          return getPreferredSelectedDate(payload);
        });
      } catch (fetchError) {
        if (!cancelled) {
          setError(getErrorMessage(fetchError, 'Failed to load calendar.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (!checkingAuth && !authError) {
      void loadCalendar();
    }

    return () => {
      cancelled = true;
    };
  }, [authError, checkingAuth, month, year]);

  async function saveClose(nextClosed: boolean) {
    if (!data) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = await saveMonthlyClose({
        year: data.year,
        month: data.month,
        ...closeForm,
        closed: nextClosed,
      });

      setData((current) =>
        current
          ? {
              ...current,
              close: payload,
            }
          : current
      );
      setCloseForm(buildCloseForm(payload));
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Failed to save monthly close.'));
    } finally {
      setSaving(false);
    }
  }

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const activeSelectedDate =
    selectedDate && selectedDate.startsWith(monthPrefix)
      ? selectedDate
      : `${monthPrefix}-01`;
  const calendarDays = buildCalendarDays(year, month);
  const eventsByDate = new Map<string, CalendarEvent[]>();

  for (const event of data?.events ?? []) {
    const existing = eventsByDate.get(event.date) ?? [];
    existing.push(event);
    eventsByDate.set(event.date, existing);
  }

  const selectedDateEvents = eventsByDate.get(activeSelectedDate) ?? [];
  const checklistComplete =
    closeForm.bills_reviewed &&
    closeForm.transfers_reviewed &&
    closeForm.disposable_reviewed &&
    closeForm.credit_cards_reviewed;
  const isClosed = Boolean(data?.close?.closed_at);
  const totalEvents = data
    ? data.summary.billCount +
      data.summary.paydayCount +
      data.summary.transferCount +
      data.summary.creditCardDueCount +
      data.summary.savingsContributionCount
    : 0;

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Cash Flow Calendar</h1>
              <p className="mt-1 text-gray-400">
                Review timing, transfers, and close each month with confidence.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const previous = shiftMonth(year, month, -1);
                  setYear(previous.year);
                  setMonth(previous.month);
                }}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800"
              >
                Previous
              </button>
              <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-sm font-medium text-white">
                {data?.label ?? 'Loading...'}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = shiftMonth(year, month, 1);
                  setYear(next.year);
                  setMonth(next.month);
                }}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800"
              >
                Next
              </button>
            </div>
          </div>

          {authError || error ? (
            <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-300">
              {authError || error}
            </div>
          ) : null}

          {checkingAuth || loading || !data ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center text-gray-400">
              {checkingAuth ? 'Checking session...' : 'Loading calendar...'}
            </div>
          ) : (
            <>
              <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Month Status</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {isClosed ? 'Closed' : 'Open'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {isClosed
                      ? `Closed on ${new Date(data.close?.closed_at ?? '').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`
                      : 'Still in review. Checklist progress is saved as you go.'}
                  </p>
                </section>

                <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Bills Checking</p>
                  <p className="mt-2 text-2xl font-bold text-blue-300">
                    {formatCurrency(data.funding.billsAccountBalance)}
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      data.funding.sufficiency === 'covered'
                        ? 'text-emerald-300'
                        : 'text-red-300'
                    }`}
                  >
                    {data.funding.sufficiency === 'covered'
                      ? `${formatCurrency(
                          data.funding.availableAfterScheduled
                        )} left after scheduled obligations`
                      : `${formatCurrency(
                          Math.abs(data.funding.availableAfterScheduled)
                        )} short for scheduled obligations`}
                  </p>
                </section>

                <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Remaining Due</p>
                  <p className="mt-2 text-2xl font-bold text-amber-300">
                    {formatCurrency(data.funding.scheduledObligations)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatCurrency(data.funding.totalScheduledObligations)} scheduled this
                    month before paid items are backed out.
                  </p>
                </section>

                <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Calendar Events</p>
                  <p className="mt-2 text-2xl font-bold text-cyan-300">{totalEvents}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {data.summary.paydayCount} paydays, {data.summary.transferCount}{' '}
                    transfers, {data.summary.billCount} bills,{' '}
                    {data.summary.creditCardDueCount} card dues.
                  </p>
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
                <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-white">Month Calendar</h2>
                      <p className="mt-1 text-xs text-gray-500">
                        Expected and actual cash movement for {data.label}.
                      </p>
                    </div>
                    <div className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
                      {monthPrefix}
                    </div>
                  </div>

                  <div className="mb-3 grid grid-cols-7 gap-2">
                    {weekdayLabels.map((label) => (
                      <div
                        key={label}
                        className="px-2 py-1 text-center text-xs uppercase tracking-wide text-gray-500"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day) => {
                      const dayKey = day.key;
                      const events = eventsByDate.get(dayKey) ?? [];
                      const isSelected = dayKey === activeSelectedDate;
                      const isToday = dayKey === isoDate(new Date());

                      return (
                        <button
                          key={dayKey}
                          type="button"
                          onClick={() => setSelectedDate(dayKey)}
                          className={`min-h-[132px] rounded-xl border p-2 text-left transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10'
                              : day.inMonth
                                ? 'border-gray-800 bg-gray-950/70 hover:border-gray-700'
                                : 'border-gray-900 bg-gray-950/30 text-gray-600'
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span
                              className={`text-sm font-medium ${
                                day.inMonth ? 'text-white' : 'text-gray-600'
                              }`}
                            >
                              {day.date.getUTCDate()}
                            </span>
                            {isToday ? (
                              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                                Today
                              </span>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            {events.slice(0, 3).map((event) => (
                              <div
                                key={event.id}
                                className={`rounded-lg border px-2 py-1 ${eventTone[event.type].cardClass}`}
                              >
                                <p className="truncate text-[11px] font-medium text-white">
                                  {event.title}
                                </p>
                                {event.amount !== null ? (
                                  <p className="mt-0.5 text-[10px] text-gray-300">
                                    {formatCurrency(event.amount)}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                            {events.length > 3 ? (
                              <p className="px-1 text-[11px] text-gray-500">
                                +{events.length - 3} more
                              </p>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <div className="space-y-6">
                  <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-white">
                          {new Date(`${activeSelectedDate}T12:00:00`).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </h2>
                        <p className="mt-1 text-xs text-gray-500">
                          {selectedDateEvents.length} event
                          {selectedDateEvents.length === 1 ? '' : 's'} scheduled for this
                          day.
                        </p>
                      </div>
                      <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
                        {activeSelectedDate}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {selectedDateEvents.length === 0 ? (
                        <div className="rounded-lg border border-gray-800 bg-gray-800/20 px-4 py-6 text-sm text-gray-500">
                          No cash-flow events for this day.
                        </div>
                      ) : (
                        selectedDateEvents.map((event) => {
                          const tone = eventTone[event.type];
                          const label = statusLabel(event.status);

                          return (
                            <article
                              key={event.id}
                              className={`rounded-xl border p-4 ${tone.cardClass}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.badgeClass}`}
                                    >
                                      {tone.label}
                                    </span>
                                    {label ? (
                                      <span className="text-[11px] text-gray-300">
                                        {label}
                                      </span>
                                    ) : null}
                                  </div>
                                  <h3 className="mt-2 text-sm font-semibold text-white">
                                    {event.title}
                                  </h3>
                                  {event.subtitle ? (
                                    <p className="mt-1 text-xs text-gray-300">
                                      {event.subtitle}
                                    </p>
                                  ) : null}
                                </div>
                                {event.amount !== null ? (
                                  <p className="text-sm font-semibold text-white">
                                    {formatCurrency(event.amount)}
                                  </p>
                                ) : null}
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-white">Monthly Close</h2>
                        <p className="mt-1 text-xs text-gray-500">
                          Save review progress, then mark the month trusted when everything
                          checks out.
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          isClosed
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {isClosed ? 'Closed' : 'In Review'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {checklistItems.map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/25 px-3 py-3 text-sm text-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={closeForm[item.key]}
                            disabled={isClosed}
                            onChange={(event) =>
                              setCloseForm((current) => ({
                                ...current,
                                [item.key]: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>

                    <label className="mt-4 block space-y-1.5">
                      <span className="text-sm font-medium text-gray-300">Close Notes</span>
                      <textarea
                        value={closeForm.notes}
                        disabled={isClosed}
                        onChange={(event) =>
                          setCloseForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="What changed, what was unusual, or what you want to remember next month."
                      />
                    </label>

                    <div className="mt-4 rounded-lg border border-gray-800 bg-gray-800/20 px-4 py-3">
                      <p className="text-sm text-gray-300">
                        {checklistComplete
                          ? 'Every review item is complete. This month can be marked closed.'
                          : 'Finish each checklist item before closing the month.'}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {isClosed ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => saveClose(false)}
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 disabled:opacity-60"
                        >
                          {saving ? 'Reopening...' : 'Reopen Month'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveClose(false)}
                            className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-100 hover:bg-gray-800 disabled:opacity-60"
                          >
                            {saving ? 'Saving...' : 'Save Review'}
                          </button>
                          <button
                            type="button"
                            disabled={saving || !checklistComplete}
                            onClick={() => saveClose(true)}
                            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {saving ? 'Closing...' : 'Mark Month Closed'}
                          </button>
                        </>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
