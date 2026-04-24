import { request } from "@/lib/client/transport";

export interface MonthlyBudget {
  id: number;
  user_id: number;
  year: number;
  month: number;
  bills_budget: number;
  disposable_budget: number;
  savings_target: number;
  extra_debt_payment_target: number;
  created_at: string;
}

export interface BudgetComparison {
  month: string;
  label: string;
  year: number;
  monthNumber: number;
  budget: MonthlyBudget | null;
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
  monthStatus: "open" | "closed";
  closedAt: string | null;
  insights: string[];
}

export interface BudgetVsActualResponse {
  months: number;
  comparisons: BudgetComparison[];
}

export interface MonthlyBudgetInput {
  year: number;
  month: number;
  bills_budget: number;
  disposable_budget: number;
  savings_target: number;
  extra_debt_payment_target: number;
}

export async function getBudgetVsActual(
  months: 6 | 12
): Promise<BudgetVsActualResponse> {
  return request<BudgetVsActualResponse>({
    path: `/api/budget-vs-actual?months=${months}`,
    tauriCommand: "get_budget_vs_actual",
    tauriArgs: { months },
  });
}

export async function saveMonthlyBudget(
  input: MonthlyBudgetInput,
  budgetId?: number
): Promise<MonthlyBudget> {
  return request<MonthlyBudget>({
    path: budgetId ? `/api/monthly-budgets/${budgetId}` : "/api/monthly-budgets",
    method: budgetId ? "PUT" : "POST",
    body: input,
    tauriCommand: budgetId ? "update_monthly_budget" : "create_monthly_budget",
    tauriArgs: budgetId
      ? {
          budgetId,
          billsBudget: input.bills_budget,
          disposableBudget: input.disposable_budget,
          savingsTarget: input.savings_target,
          extraDebtPaymentTarget: input.extra_debt_payment_target,
        }
      : {
          year: input.year,
          month: input.month,
          billsBudget: input.bills_budget,
          disposableBudget: input.disposable_budget,
          savingsTarget: input.savings_target,
          extraDebtPaymentTarget: input.extra_debt_payment_target,
        },
  });
}
