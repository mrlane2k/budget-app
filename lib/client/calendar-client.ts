import { request } from "@/lib/client/transport";

export type CalendarEventType =
  | "bill_due"
  | "payday"
  | "transfer"
  | "credit_card_due"
  | "savings_contribution";

export interface CalendarEvent {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  subtitle: string | null;
  amount: number | null;
  status: string | null;
}

export interface MonthlyClose {
  id: number;
  year: number;
  month: number;
  bills_reviewed: boolean;
  transfers_reviewed: boolean;
  disposable_reviewed: boolean;
  credit_cards_reviewed: boolean;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarResponse {
  year: number;
  month: number;
  label: string;
  events: CalendarEvent[];
  summary: {
    billCount: number;
    paydayCount: number;
    transferCount: number;
    creditCardDueCount: number;
    savingsContributionCount: number;
  };
  funding: {
    billsAccountBalance: number;
    totalScheduledObligations: number;
    scheduledObligations: number;
    availableAfterScheduled: number;
    sufficiency: "covered" | "short";
  };
  close: MonthlyClose | null;
}

export interface MonthlyCloseInput {
  year: number;
  month: number;
  bills_reviewed: boolean;
  transfers_reviewed: boolean;
  disposable_reviewed: boolean;
  credit_cards_reviewed: boolean;
  notes: string;
  closed: boolean;
}

export async function getCalendarMonth(input: {
  year: number;
  month: number;
}): Promise<CalendarResponse> {
  const { year, month } = input;
  return request<CalendarResponse>({
    path: `/api/calendar?year=${year}&month=${month}`,
    tauriCommand: "get_calendar_month",
    tauriArgs: { year, month },
  });
}

export async function saveMonthlyClose(
  input: MonthlyCloseInput
): Promise<MonthlyClose> {
  return request<MonthlyClose>({
    path: "/api/monthly-close",
    method: "POST",
    body: input,
    tauriCommand: "save_monthly_close",
    tauriArgs: {
      year: input.year,
      month: input.month,
      billsReviewed: input.bills_reviewed,
      transfersReviewed: input.transfers_reviewed,
      disposableReviewed: input.disposable_reviewed,
      creditCardsReviewed: input.credit_cards_reviewed,
      notes: input.notes,
      closed: input.closed,
    },
  });
}
