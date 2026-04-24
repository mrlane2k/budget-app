import { request } from "@/lib/client/transport";

export interface TrendPoint {
  month: string;
  label: string;
  value: number;
}

export interface TrendsResponse {
  months: number;
  billsPaidByMonth: TrendPoint[];
  disposableSpendingByMonth: TrendPoint[];
  savingsContributionsByMonth: TrendPoint[];
  creditCardPurchasesByMonth: TrendPoint[];
  creditCardPaymentsByMonth: TrendPoint[];
  creditCardInterestByMonth: TrendPoint[];
  netOutflowByMonth: TrendPoint[];
}

export async function getMonthlyTrends(months: 6 | 12): Promise<TrendsResponse> {
  return request<TrendsResponse>({
    path: `/api/trends?months=${months}`,
    tauriCommand: "get_monthly_trends",
    tauriArgs: { months },
  });
}
