import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction, type Queryable } from "@/lib/db";

type AuthUserRow = {
  id: number;
  username: string;
  password_hash: string;
};

type PublicUserRow = {
  id: number;
  username: string;
  pay_cycle: string;
  last_paycheck_date: string | null;
  monthly_income: number;
  current_savings: number;
  extra_cc_payment: number;
  created_at: string;
};

type BillRow = {
  id: number;
  user_id: number;
  name: string;
  category: string | null;
  amount: number;
  due_day: number;
  due_date: string | null;
  is_autopay: number;
  active: number;
  frequency: string;
  status?: string | null;
  amount_paid?: number | null;
  paid_at?: string | null;
  payment_id?: number | null;
};

type BillPaymentRow = {
  id?: number;
  bill_id: number;
  year: number;
  month: number;
  status: string;
  amount_paid: number | null;
  paid_at?: string | null;
};

type CreditCardRow = {
  id: number;
  user_id: number;
  name: string;
  balance: number;
  credit_limit: number;
  minimum_payment: number;
  apr: number;
  due_day: number;
  last_four: string | null;
  active?: number;
};

type CreditCardTransactionRow = {
  id: number;
  card_id: number;
  type: "purchase" | "payment" | "interest" | "fee" | "adjustment";
  amount: number;
  note: string | null;
  category: string | null;
  merchant_name: string | null;
  source_account_id: number | null;
  transaction_date: string;
  created_at: string;
};

type TrendPoint = {
  month: string;
  label: string;
  value: number;
};

type TrendsPayload = {
  billsPaidByMonth: TrendPoint[];
  disposableSpendingByMonth: TrendPoint[];
  savingsContributionsByMonth: TrendPoint[];
  creditCardPurchasesByMonth: TrendPoint[];
  creditCardPaymentsByMonth: TrendPoint[];
  creditCardInterestByMonth: TrendPoint[];
  netOutflowByMonth: TrendPoint[];
};

type MonthlyBudgetRow = {
  id: number;
  user_id: number;
  year: number;
  month: number;
  bills_budget: number;
  disposable_budget: number;
  savings_target: number;
  extra_debt_payment_target: number;
  created_at: string;
};

type BudgetActuals = {
  bills: number;
  disposable: number;
  savings: number;
  extraDebt: number;
};

type BudgetVsActualRow = {
  month: string;
  label: string;
  year: number;
  month_number: number;
  budget_id: number | null;
  budget_created_at: string | null;
  bills_budget: number | null;
  disposable_budget: number | null;
  savings_target: number | null;
  extra_debt_payment_target: number | null;
  bills_actual: number;
  disposable_actual: number;
  savings_actual: number;
  extra_debt_actual: number;
  closed_at: string | null;
};

type BudgetVsActualComparison = {
  month: string;
  label: string;
  year: number;
  monthNumber: number;
  budget: MonthlyBudgetRow | null;
  actuals: BudgetActuals;
  variances: BudgetActuals;
  plannedTotal: number | null;
  actualTotal: number;
  monthStatus: "open" | "closed";
  closedAt: string | null;
  insights: string[];
};

type BudgetVsActualPayload = {
  comparisons: BudgetVsActualComparison[];
};

type MonthlyCloseRow = {
  id: number;
  user_id: number;
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
};

type CalendarEventType =
  | "bill_due"
  | "payday"
  | "transfer"
  | "credit_card_due"
  | "savings_contribution";

type CalendarEvent = {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  subtitle: string | null;
  amount: number | null;
  status: string | null;
};

type CalendarFundingSummary = {
  billsAccountBalance: number;
  totalScheduledObligations: number;
  scheduledObligations: number;
  availableAfterScheduled: number;
  sufficiency: "covered" | "short";
};

type CalendarMonthPayload = {
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
  funding: CalendarFundingSummary;
  close: MonthlyCloseRow | null;
};

type AccountType = "checking" | "savings" | "credit_card";
type AccountPurpose = "bills" | "disposable" | "savings" | "credit_card";
type CashDirection = "inflow" | "outflow";
type CashTransactionKind =
  | "bill_payment"
  | "discretionary_spend"
  | "transfer"
  | "income"
  | "savings_contribution"
  | "adjustment";

type AccountRow = {
  id: number;
  user_id: number;
  name: string;
  institution_name: string | null;
  last_four: string | null;
  account_type: AccountType;
  account_purpose: AccountPurpose;
  current_balance: number;
  is_manual: boolean;
  is_active: boolean;
  plaid_account_id: string | null;
  created_at: string;
};

type CashTransactionRow = {
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
};

type CashTransactionRecordRow = {
  id: number;
  user_id: number;
  account_id: number;
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
};

type TransferRow = {
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
};

type CountRow = { count: number };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addPayCycle(date: Date, payCycle: string): Date {
  const next = new Date(date);

  switch (payCycle) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "bi-weekly":
      next.setDate(next.getDate() + 14);
      break;
    case "semi-monthly": {
      const day = next.getDate();
      if (day < 15) {
        next.setDate(15);
      } else {
        next.setMonth(next.getMonth() + 1, 1);
      }
      break;
    }
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 14);
      break;
  }

  return next;
}

function getExpectedPaydaysForMonth(
  payCycle: string,
  lastPaycheckDate: string | null,
  year: number,
  month: number
): Date[] {
  if (!lastPaycheckDate) {
    return [];
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  monthEnd.setUTCHours(23, 59, 59, 999);

  let cursor = new Date(`${lastPaycheckDate}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime())) {
    return [];
  }

  const paydays: Date[] = [];
  let guard = 0;

  while (cursor < monthStart && guard < 100) {
    cursor = addPayCycle(cursor, payCycle);
    guard += 1;
  }

  while (cursor <= monthEnd && guard < 140) {
    if (cursor >= monthStart) {
      paydays.push(new Date(cursor));
    }
    cursor = addPayCycle(cursor, payCycle);
    guard += 1;
  }

  return paydays;
}

function dayCountInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getBillDueDatesForMonth(
  bill: { frequency: string; due_day: number; due_date?: string | null },
  year: number,
  month: number
): Date[] {
  if (bill.frequency === "monthly" || !bill.frequency) {
    return [
      new Date(
        Date.UTC(year, month - 1, Math.min(dayCountInMonth(year, month), bill.due_day))
      ),
    ];
  }

  if (!bill.due_date) {
    return [];
  }

  const anchor = new Date(`${bill.due_date}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime())) {
    return [];
  }

  const targetMonthIndex = year * 12 + (month - 1);
  const anchorMonthIndex =
    anchor.getUTCFullYear() * 12 + anchor.getUTCMonth();
  const monthDelta = targetMonthIndex - anchorMonthIndex;

  if (monthDelta < 0) {
    return [];
  }

  if (bill.frequency === "annually") {
    if (anchor.getUTCMonth() !== month - 1) {
      return [];
    }

    return [
      new Date(
        Date.UTC(
          year,
          month - 1,
          Math.min(dayCountInMonth(year, month), anchor.getUTCDate())
        )
      ),
    ];
  }

  const monthStep = bill.frequency === "quarterly" ? 3 : 6;
  if (monthDelta % monthStep !== 0) {
    return [];
  }

  return [
    new Date(
      Date.UTC(
        year,
        month - 1,
        Math.min(dayCountInMonth(year, month), anchor.getUTCDate())
      )
    ),
  ];
}

function getCreditCardDueDateForMonth(
  dueDay: number,
  year: number,
  month: number
): Date {
  return new Date(
    Date.UTC(year, month - 1, Math.min(dayCountInMonth(year, month), dueDay))
  );
}

function sortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  const typeOrder: Record<CalendarEventType, number> = {
    payday: 1,
    bill_due: 2,
    credit_card_due: 3,
    transfer: 4,
    savings_contribution: 5,
  };

  return [...events].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    const typeDelta = typeOrder[left.type] - typeOrder[right.type];
    if (typeDelta !== 0) {
      return typeDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

function signedAmount(direction: CashDirection, amount: number): number {
  return direction === "inflow" ? amount : -amount;
}

function accountOrderingClause(): string {
  return `
    CASE account_purpose
      WHEN 'bills' THEN 1
      WHEN 'disposable' THEN 2
      WHEN 'savings' THEN 3
      ELSE 4
    END,
    name
  `;
}

function queryable(): Queryable {
  return {
    query,
  };
}

async function one<T extends QueryResultRow>(
  db: Queryable,
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const result = await db.query<T>(text, params);
  return result.rows[0] ?? null;
}

async function syncUserSavingsFromAccounts(
  db: Queryable,
  userId: number
): Promise<void> {
  const result = await db.query<{ total: number }>(
    `
      SELECT COALESCE(SUM(current_balance), 0) AS total
      FROM accounts
      WHERE user_id = $1
        AND account_purpose = 'savings'
        AND is_active = TRUE
    `,
    [userId]
  );

  await db.query(
    `
      UPDATE users
      SET current_savings = $1
      WHERE id = $2
    `,
    [result.rows[0]?.total ?? 0, userId]
  );
}

async function createDefaultAccountsForUser(
  db: Queryable,
  userId: number,
  savingsBalance: number
): Promise<void> {
  await db.query(
    `
      INSERT INTO accounts (
        user_id,
        name,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active
      )
      VALUES
        ($1, 'Bills Checking', 'checking', 'bills', 0, TRUE, TRUE),
        ($1, 'Disposable Checking', 'checking', 'disposable', 0, TRUE, TRUE),
        ($1, 'Savings', 'savings', 'savings', $2, TRUE, TRUE)
    `,
    [userId, savingsBalance]
  );
}

async function getAccountByIdInternal(
  db: Queryable,
  userId: number,
  accountId: number,
  options?: { forUpdate?: boolean }
): Promise<AccountRow | null> {
  const lockingClause = options?.forUpdate ? " FOR UPDATE" : "";

  return one<AccountRow>(
    db,
    `
      SELECT
        id,
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active,
        plaid_account_id,
        created_at::text
      FROM accounts
      WHERE id = $1
        AND user_id = $2
      ${lockingClause}
    `,
    [accountId, userId]
  );
}

async function adjustAccountBalance(
  db: Queryable,
  userId: number,
  accountId: number,
  delta: number
): Promise<AccountRow | null> {
  const account = await one<AccountRow>(
    db,
    `
      UPDATE accounts
      SET current_balance = current_balance + $1
      WHERE id = $2
        AND user_id = $3
      RETURNING
        id,
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active,
        plaid_account_id,
        created_at::text
    `,
    [delta, accountId, userId]
  );

  if (account?.account_purpose === "savings") {
    await syncUserSavingsFromAccounts(db, userId);
  }

  return account;
}

export async function isSetupRequired(): Promise<boolean> {
  const result = await query<CountRow>(
    "SELECT COUNT(*)::int AS count FROM users"
  );
  return result.rows[0]?.count === 0;
}

export async function getAuthUserByUsername(
  username: string
): Promise<AuthUserRow | null> {
  return one<AuthUserRow>(
    queryable(),
    `
      SELECT id, username, password_hash
      FROM users
      WHERE username = $1
    `,
    [username]
  );
}

export async function createInitialUser(input: {
  username: string;
  passwordHash: string;
}): Promise<PublicUserRow> {
  return withTransaction(async (client) => {
    const count = await one<CountRow>(
      client,
      "SELECT COUNT(*)::int AS count FROM users"
    );

    if ((count?.count ?? 0) > 0) {
      throw new Error("SETUP_ALREADY_COMPLETE");
    }

    const user = await one<PublicUserRow>(
      client,
      `
        INSERT INTO users (
          username,
          password_hash,
          pay_cycle,
          last_paycheck_date,
          monthly_income,
          current_savings,
          extra_cc_payment
        )
        VALUES ($1, $2, 'bi-weekly', NULL, 0, 0, 0)
        RETURNING
          id,
          username,
          pay_cycle,
          last_paycheck_date::text,
          monthly_income,
          current_savings,
          extra_cc_payment,
          created_at::text
      `,
      [input.username, input.passwordHash]
    );

    if (!user) {
      throw new Error("Failed to create initial user.");
    }

    await createDefaultAccountsForUser(client, user.id, user.current_savings);

    return user;
  });
}

export async function getUserProfileById(
  userId: number
): Promise<PublicUserRow | null> {
  return one<PublicUserRow>(
    queryable(),
    `
      SELECT
        id,
        username,
        pay_cycle,
        last_paycheck_date::text,
        monthly_income,
        current_savings,
        extra_cc_payment,
        created_at::text
      FROM users
      WHERE id = $1
    `,
    [userId]
  );
}

export async function changeUserPassword(
  userId: number,
  passwordHash: string
): Promise<void> {
  await query(
    `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
    `,
    [passwordHash, userId]
  );
}

export async function updateUserSettings(
  userId: number,
  input: {
    pay_cycle?: string;
    last_paycheck_date?: string | null;
    monthly_income?: number;
    current_savings?: number;
    extra_cc_payment?: number;
  }
): Promise<PublicUserRow | null> {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.pay_cycle !== undefined) {
    updates.push(`pay_cycle = $${updates.length + 1}`);
    values.push(input.pay_cycle);
  }
  if (input.last_paycheck_date !== undefined) {
    updates.push(`last_paycheck_date = $${updates.length + 1}`);
    values.push(input.last_paycheck_date);
  }
  if (input.monthly_income !== undefined) {
    updates.push(`monthly_income = $${updates.length + 1}`);
    values.push(input.monthly_income);
  }
  if (input.current_savings !== undefined) {
    updates.push(`current_savings = $${updates.length + 1}`);
    values.push(input.current_savings);
  }
  if (input.extra_cc_payment !== undefined) {
    updates.push(`extra_cc_payment = $${updates.length + 1}`);
    values.push(input.extra_cc_payment);
  }

  if (updates.length > 0) {
    values.push(userId);
    await query(
      `
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
      `,
      values
    );
  }

  if (input.current_savings !== undefined) {
    await query(
      `
        UPDATE accounts
        SET current_balance = $2
        WHERE id = (
          SELECT id
          FROM accounts
          WHERE user_id = $1
            AND account_purpose = 'savings'
            AND is_active = TRUE
          ORDER BY id
          LIMIT 1
        )
      `,
      [userId, input.current_savings]
    );
    await syncUserSavingsFromAccounts(queryable(), userId);
  }

  return getUserProfileById(userId);
}

export async function listBillsForMonth(
  userId: number,
  year: number,
  month: number
): Promise<BillRow[]> {
  const result = await query<BillRow>(
    `
      SELECT
        b.id,
        b.user_id,
        b.name,
        b.category,
        b.amount,
        b.due_day,
        b.due_date::text,
        CASE WHEN b.is_autopay THEN 1 ELSE 0 END AS is_autopay,
        CASE WHEN b.active THEN 1 ELSE 0 END AS active,
        b.frequency,
        bp.status,
        bp.amount_paid,
        bp.paid_at::text,
        bp.id AS payment_id
      FROM bills b
      LEFT JOIN bill_payments bp
        ON bp.bill_id = b.id
       AND bp.year = $1
       AND bp.month = $2
      WHERE b.user_id = $3
        AND b.active = TRUE
      ORDER BY
        CASE WHEN b.frequency = 'monthly' THEN b.due_day ELSE 32 END,
        COALESCE(b.due_date, CURRENT_DATE),
        b.name
    `,
    [year, month, userId]
  );

  return result.rows;
}

export async function getBillById(
  userId: number,
  billId: number
): Promise<BillRow | null> {
  return one<BillRow>(
    queryable(),
    `
      SELECT
        id,
        user_id,
        name,
        category,
        amount,
        due_day,
        due_date::text,
        CASE WHEN is_autopay THEN 1 ELSE 0 END AS is_autopay,
        CASE WHEN active THEN 1 ELSE 0 END AS active,
        frequency
      FROM bills
      WHERE id = $1
        AND user_id = $2
    `,
    [billId, userId]
  );
}

export async function createBill(
  userId: number,
  input: {
    name: string;
    category?: string | null;
    amount: number;
    due_day: number;
    is_autopay: boolean;
    frequency: string;
    due_date?: string | null;
  }
): Promise<BillRow | null> {
  return one<BillRow>(
    queryable(),
    `
      INSERT INTO bills (
        user_id,
        name,
        category,
        amount,
        due_day,
        is_autopay,
        frequency,
        due_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        user_id,
        name,
        category,
        amount,
        due_day,
        due_date::text,
        CASE WHEN is_autopay THEN 1 ELSE 0 END AS is_autopay,
        CASE WHEN active THEN 1 ELSE 0 END AS active,
        frequency
    `,
    [
      userId,
      input.name,
      input.category ?? null,
      input.amount,
      input.due_day,
      input.is_autopay,
      input.frequency,
      input.due_date ?? null,
    ]
  );
}

export async function updateBill(
  userId: number,
  billId: number,
  input: {
    name: string;
    category?: string | null;
    amount: number;
    due_day: number;
    is_autopay: boolean;
    frequency: string;
    due_date?: string | null;
  }
): Promise<BillRow | null> {
  return one<BillRow>(
    queryable(),
    `
      UPDATE bills
      SET
        name = $1,
        category = $2,
        amount = $3,
        due_day = $4,
        is_autopay = $5,
        frequency = $6,
        due_date = $7
      WHERE id = $8
        AND user_id = $9
      RETURNING
        id,
        user_id,
        name,
        category,
        amount,
        due_day,
        due_date::text,
        CASE WHEN is_autopay THEN 1 ELSE 0 END AS is_autopay,
        CASE WHEN active THEN 1 ELSE 0 END AS active,
        frequency
    `,
    [
      input.name,
      input.category ?? null,
      input.amount,
      input.due_day,
      input.is_autopay,
      input.frequency,
      input.due_date ?? null,
      billId,
      userId,
    ]
  );
}

export async function deactivateBill(
  userId: number,
  billId: number
): Promise<void> {
  await query(
    `
      UPDATE bills
      SET active = FALSE
      WHERE id = $1
        AND user_id = $2
    `,
    [billId, userId]
  );
}

export async function getBillPayment(
  userId: number,
  billId: number,
  year: number,
  month: number
): Promise<BillPaymentRow | null> {
  return one<BillPaymentRow>(
    queryable(),
    `
      SELECT
        bp.id,
        bp.bill_id,
        bp.year,
        bp.month,
        bp.status,
        bp.amount_paid,
        bp.paid_at::text
      FROM bill_payments bp
      INNER JOIN bills b ON b.id = bp.bill_id
      WHERE bp.bill_id = $1
        AND bp.year = $2
        AND bp.month = $3
        AND b.user_id = $4
    `,
    [billId, year, month, userId]
  );
}

export async function upsertBillPayment(
  userId: number,
  billId: number,
  input: {
    year: number;
    month: number;
    status: string;
    amount_paid: number | null;
    paid_at: string | null;
  }
): Promise<BillPaymentRow | null> {
  const bill = await getBillById(userId, billId);
  if (!bill) {
    return null;
  }

  const result = await query<BillPaymentRow>(
    `
      INSERT INTO bill_payments (
        bill_id,
        year,
        month,
        status,
        amount_paid,
        paid_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (bill_id, year, month) DO UPDATE SET
        status = EXCLUDED.status,
        amount_paid = EXCLUDED.amount_paid,
        paid_at = EXCLUDED.paid_at
      RETURNING
        id,
        bill_id,
        year,
        month,
        status,
        amount_paid,
        paid_at::text
    `,
    [
      billId,
      input.year,
      input.month,
      input.status,
      input.amount_paid,
      input.paid_at,
    ]
  );

  return result.rows[0] ?? null;
}

export async function listActiveCreditCards(
  userId: number
): Promise<CreditCardRow[]> {
  const result = await query<CreditCardRow>(
    `
      SELECT
        id,
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four,
        CASE WHEN active THEN 1 ELSE 0 END AS active
      FROM credit_cards
      WHERE user_id = $1
        AND active = TRUE
      ORDER BY apr DESC, name
    `,
    [userId]
  );

  return result.rows;
}

export async function getCreditCardById(
  userId: number,
  cardId: number,
  options?: { forUpdate?: boolean; client?: PoolClient }
): Promise<CreditCardRow | null> {
  const db = options?.client ?? queryable();
  const lockingClause = options?.forUpdate ? " FOR UPDATE" : "";

  return one<CreditCardRow>(
    db,
    `
      SELECT
        id,
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four,
        CASE WHEN active THEN 1 ELSE 0 END AS active
      FROM credit_cards
      WHERE id = $1
        AND user_id = $2
      ${lockingClause}
    `,
    [cardId, userId]
  );
}

export async function createCreditCard(
  userId: number,
  input: {
    name: string;
    balance: number;
    credit_limit: number;
    minimum_payment: number;
    apr: number;
    due_day: number;
    last_four?: string | null;
  }
): Promise<CreditCardRow | null> {
  return one<CreditCardRow>(
    queryable(),
    `
      INSERT INTO credit_cards (
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four,
        CASE WHEN active THEN 1 ELSE 0 END AS active
    `,
    [
      userId,
      input.name,
      input.balance,
      input.credit_limit,
      input.minimum_payment,
      input.apr,
      input.due_day,
      input.last_four ?? null,
    ]
  );
}

export async function updateCreditCard(
  userId: number,
  cardId: number,
  input: {
    name: string;
    balance: number;
    credit_limit: number;
    minimum_payment: number;
    apr: number;
    due_day: number;
    last_four?: string | null;
  }
): Promise<CreditCardRow | null> {
  return one<CreditCardRow>(
    queryable(),
    `
      UPDATE credit_cards
      SET
        name = $1,
        balance = $2,
        credit_limit = $3,
        minimum_payment = $4,
        apr = $5,
        due_day = $6,
        last_four = $7
      WHERE id = $8
        AND user_id = $9
      RETURNING
        id,
        user_id,
        name,
        balance,
        credit_limit,
        minimum_payment,
        apr,
        due_day,
        last_four,
        CASE WHEN active THEN 1 ELSE 0 END AS active
    `,
    [
      input.name,
      input.balance,
      input.credit_limit,
      input.minimum_payment,
      input.apr,
      input.due_day,
      input.last_four ?? null,
      cardId,
      userId,
    ]
  );
}

export async function deactivateCreditCard(
  userId: number,
  cardId: number
): Promise<void> {
  await query(
    `
      UPDATE credit_cards
      SET active = FALSE
      WHERE id = $1
        AND user_id = $2
    `,
    [cardId, userId]
  );
}

export async function listCreditCardTransactions(
  userId: number,
  cardId: number
): Promise<CreditCardTransactionRow[]> {
  const result = await query<CreditCardTransactionRow>(
    `
      SELECT
        cct.id,
        cct.card_id,
        cct.type,
        cct.amount,
        cct.note,
        cct.category,
        cct.merchant_name,
        cct.source_account_id,
        cct.transaction_date::text,
        cct.created_at::text
      FROM credit_card_transactions cct
      INNER JOIN credit_cards cc ON cc.id = cct.card_id
      WHERE cc.id = $1
        AND cc.user_id = $2
      ORDER BY cct.transaction_date DESC, cct.id DESC
    `,
    [cardId, userId]
  );

  return result.rows;
}

export async function addCreditCardLedgerEntries(
  userId: number,
  cardId: number,
  input: {
    transactionDate: string;
    entries: Array<{
      type: "purchase" | "payment" | "interest" | "fee" | "adjustment";
      amount: number;
      note?: string | null;
      category?: string | null;
      merchant_name?: string | null;
      source_account_id?: number | null;
    }>;
  }
): Promise<{
  card: CreditCardRow;
  transactions: CreditCardTransactionRow[];
} | null> {
  return withTransaction(async (client) => {
    const card = await getCreditCardById(userId, cardId, {
      client,
      forUpdate: true,
    });

    if (!card || card.active === 0) {
      return null;
    }

    if (input.entries.length === 0) {
      return null;
    }

    let balanceDelta = 0;
    for (const entry of input.entries) {
      if (entry.source_account_id !== undefined && entry.source_account_id !== null) {
        const sourceAccount = await getAccountById(userId, entry.source_account_id, {
          client,
          forUpdate: true,
        });
        if (!sourceAccount || !sourceAccount.is_active) {
          throw new Error("ACCOUNT_NOT_FOUND");
        }
      }

      await client.query(
        `
          INSERT INTO credit_card_transactions (
            card_id,
            type,
            amount,
            note,
            category,
            merchant_name,
            source_account_id,
            transaction_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          cardId,
          entry.type,
          entry.amount,
          entry.note ?? null,
          entry.category ?? null,
          entry.merchant_name ?? null,
          entry.source_account_id ?? null,
          input.transactionDate,
        ]
      );

      switch (entry.type) {
        case "payment":
          balanceDelta -= entry.amount;
          break;
        case "adjustment":
          balanceDelta += entry.amount;
          break;
        default:
          balanceDelta += entry.amount;
          break;
      }
    }

    const newBalance = roundMoney(Math.max(0, card.balance + balanceDelta));

    const updatedCard = await one<CreditCardRow>(
      client,
      `
        UPDATE credit_cards
        SET balance = $1
        WHERE id = $2
          AND user_id = $3
        RETURNING
          id,
          user_id,
          name,
          balance,
          credit_limit,
          minimum_payment,
          apr,
          due_day,
          last_four,
          CASE WHEN active THEN 1 ELSE 0 END AS active
      `,
      [newBalance, cardId, userId]
    );

    const transactionsResult = await client.query<CreditCardTransactionRow>(
      `
        SELECT
          cct.id,
          cct.card_id,
          cct.type,
          cct.amount,
          cct.note,
          cct.category,
          cct.merchant_name,
          cct.source_account_id,
          cct.transaction_date::text,
          cct.created_at::text
        FROM credit_card_transactions cct
        WHERE cct.card_id = $1
        ORDER BY cct.transaction_date DESC, cct.id DESC
        LIMIT 10
      `,
      [cardId]
    );

    if (!updatedCard) {
      throw new Error("Failed to update credit card balance.");
    }

    return {
      card: updatedCard,
      transactions: transactionsResult.rows,
    };
  });
}

export async function getCreditCardPaymentSummary(
  userId: number
): Promise<Record<number, { paid: boolean; amount_paid: number }>> {
  const result = await query<{
    card_id: number;
    amount_paid: number;
  }>(
    `
      SELECT
        cc.id AS card_id,
        COALESCE(SUM(cct.amount), 0) AS amount_paid
      FROM credit_cards cc
      LEFT JOIN credit_card_transactions cct
        ON cct.card_id = cc.id
       AND cct.type = 'payment'
       AND cct.transaction_date >= date_trunc('month', CURRENT_DATE)::date
       AND cct.transaction_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
      WHERE cc.user_id = $1
        AND cc.active = TRUE
      GROUP BY cc.id
    `,
    [userId]
  );

  return result.rows.reduce<Record<number, { paid: boolean; amount_paid: number }>>(
    (summary, row) => {
      summary[row.card_id] = {
        paid: row.amount_paid > 0,
        amount_paid: row.amount_paid,
      };
      return summary;
    },
    {}
  );
}

function mapTrendRows(rows: Array<{ month: string; label: string; value: number }>): TrendPoint[] {
  return rows.map((row) => ({
    month: row.month,
    label: row.label,
    value: row.value,
  }));
}

function buildBudgetInsights(
  comparison: Omit<BudgetVsActualComparison, "insights">,
  previous: BudgetVsActualComparison | null
): string[] {
  const insights: string[] = [];

  if (!comparison.budget) {
    insights.push("No monthly targets saved yet. Add a budget to compare this month against a plan.");
  } else {
    const varianceRules = [
      {
        label: "Bills",
        variance: comparison.variances.bills,
        overText: "ran over target",
        underText: "came in under target",
      },
      {
        label: "Disposable spending",
        variance: comparison.variances.disposable,
        overText: "ran over target",
        underText: "came in under target",
      },
      {
        label: "Savings",
        variance: comparison.variances.savings,
        overText: "finished ahead of target",
        underText: "is short of target",
      },
      {
        label: "Extra debt paydown",
        variance: comparison.variances.extraDebt,
        overText: "finished ahead of target",
        underText: "is short of target",
      },
    ] as const;

    for (const rule of varianceRules) {
      if (Math.abs(rule.variance) < 0.01) {
        continue;
      }

      if (rule.variance > 0) {
        insights.push(
          `${rule.label} ${rule.overText} by ${formatCurrency(rule.variance)}.`
        );
      } else {
        insights.push(
          `${rule.label} ${rule.underText} by ${formatCurrency(Math.abs(rule.variance))}.`
        );
      }
    }
  }

  if (previous) {
    const changes = [
      {
        label: "Bills paid",
        delta: comparison.actuals.bills - previous.actuals.bills,
      },
      {
        label: "Disposable spending",
        delta: comparison.actuals.disposable - previous.actuals.disposable,
      },
      {
        label: "Savings contributions",
        delta: comparison.actuals.savings - previous.actuals.savings,
      },
      {
        label: "Extra debt paydown",
        delta: comparison.actuals.extraDebt - previous.actuals.extraDebt,
      },
    ]
      .filter((entry) => Math.abs(entry.delta) >= 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 2);

    for (const change of changes) {
      insights.push(
        `${change.label} moved ${
          change.delta > 0 ? "up" : "down"
        } by ${formatCurrency(Math.abs(change.delta))} from ${previous.label}.`
      );
    }
  }

  if (insights.length === 0) {
    insights.push("This month is tracking right on plan so far.");
  }

  return insights.slice(0, 4);
}

export async function listMonthlyBudgets(
  userId: number,
  options?: { months?: number; year?: number; month?: number }
): Promise<MonthlyBudgetRow[]> {
  if (options?.year !== undefined && options?.month !== undefined) {
    const result = await query<MonthlyBudgetRow>(
      `
        SELECT
          id,
          user_id,
          year,
          month,
          bills_budget,
          disposable_budget,
          savings_target,
          extra_debt_payment_target,
          created_at::text
        FROM monthly_budgets
        WHERE user_id = $1
          AND year = $2
          AND month = $3
        ORDER BY year DESC, month DESC
      `,
      [userId, options.year, options.month]
    );

    return result.rows;
  }

  const normalizedMonths = Math.max(1, Math.min(options?.months ?? 12, 24));
  const result = await query<MonthlyBudgetRow>(
    `
      SELECT
        id,
        user_id,
        year,
        month,
        bills_budget,
        disposable_budget,
        savings_target,
        extra_debt_payment_target,
        created_at::text
      FROM monthly_budgets
      WHERE user_id = $1
        AND make_date(year, month, 1) >= date_trunc('month', CURRENT_DATE) - make_interval(months => $2::int - 1)
      ORDER BY year DESC, month DESC
    `,
    [userId, normalizedMonths]
  );

  return result.rows;
}

export async function createMonthlyBudget(
  userId: number,
  input: {
    year: number;
    month: number;
    bills_budget: number;
    disposable_budget: number;
    savings_target: number;
    extra_debt_payment_target: number;
  }
): Promise<MonthlyBudgetRow | null> {
  return one<MonthlyBudgetRow>(
    queryable(),
    `
      INSERT INTO monthly_budgets (
        user_id,
        year,
        month,
        bills_budget,
        disposable_budget,
        savings_target,
        extra_debt_payment_target
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        user_id,
        year,
        month,
        bills_budget,
        disposable_budget,
        savings_target,
        extra_debt_payment_target,
        created_at::text
    `,
    [
      userId,
      input.year,
      input.month,
      input.bills_budget,
      input.disposable_budget,
      input.savings_target,
      input.extra_debt_payment_target,
    ]
  );
}

export async function updateMonthlyBudget(
  userId: number,
  budgetId: number,
  input: {
    bills_budget: number;
    disposable_budget: number;
    savings_target: number;
    extra_debt_payment_target: number;
  }
): Promise<MonthlyBudgetRow | null> {
  return one<MonthlyBudgetRow>(
    queryable(),
    `
      UPDATE monthly_budgets
      SET
        bills_budget = $1,
        disposable_budget = $2,
        savings_target = $3,
        extra_debt_payment_target = $4
      WHERE id = $5
        AND user_id = $6
      RETURNING
        id,
        user_id,
        year,
        month,
        bills_budget,
        disposable_budget,
        savings_target,
        extra_debt_payment_target,
        created_at::text
    `,
    [
      input.bills_budget,
      input.disposable_budget,
      input.savings_target,
      input.extra_debt_payment_target,
      budgetId,
      userId,
    ]
  );
}

export async function getMonthlyClose(
  userId: number,
  year: number,
  month: number
): Promise<MonthlyCloseRow | null> {
  return one<MonthlyCloseRow>(
    queryable(),
    `
      SELECT
        id,
        user_id,
        year,
        month,
        bills_reviewed,
        transfers_reviewed,
        disposable_reviewed,
        credit_cards_reviewed,
        closed_at::text,
        notes,
        created_at::text,
        updated_at::text
      FROM monthly_closes
      WHERE user_id = $1
        AND year = $2
        AND month = $3
    `,
    [userId, year, month]
  );
}

export async function upsertMonthlyClose(
  userId: number,
  input: {
    year: number;
    month: number;
    bills_reviewed: boolean;
    transfers_reviewed: boolean;
    disposable_reviewed: boolean;
    credit_cards_reviewed: boolean;
    notes?: string | null;
    closed?: boolean;
  }
): Promise<MonthlyCloseRow> {
  const shouldClose = input.closed ?? false;
  const checklistComplete =
    input.bills_reviewed &&
    input.transfers_reviewed &&
    input.disposable_reviewed &&
    input.credit_cards_reviewed;

  if (shouldClose && !checklistComplete) {
    throw new Error("MONTH_CLOSE_INCOMPLETE");
  }

  const row = await one<MonthlyCloseRow>(
    queryable(),
    `
      INSERT INTO monthly_closes (
        user_id,
        year,
        month,
        bills_reviewed,
        transfers_reviewed,
        disposable_reviewed,
        credit_cards_reviewed,
        closed_at,
        notes
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        CASE WHEN $8 THEN NOW() ELSE NULL END,
        $9
      )
      ON CONFLICT (user_id, year, month)
      DO UPDATE SET
        bills_reviewed = EXCLUDED.bills_reviewed,
        transfers_reviewed = EXCLUDED.transfers_reviewed,
        disposable_reviewed = EXCLUDED.disposable_reviewed,
        credit_cards_reviewed = EXCLUDED.credit_cards_reviewed,
        closed_at = CASE
          WHEN $8 THEN COALESCE(monthly_closes.closed_at, NOW())
          ELSE NULL
        END,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        year,
        month,
        bills_reviewed,
        transfers_reviewed,
        disposable_reviewed,
        credit_cards_reviewed,
        closed_at::text,
        notes,
        created_at::text,
        updated_at::text
    `,
    [
      userId,
      input.year,
      input.month,
      input.bills_reviewed,
      input.transfers_reviewed,
      input.disposable_reviewed,
      input.credit_cards_reviewed,
      shouldClose,
      input.notes?.trim() || null,
    ]
  );

  if (!row) {
    throw new Error("MONTH_CLOSE_SAVE_FAILED");
  }

  return row;
}

export async function getCalendarMonth(
  userId: number,
  year: number,
  month: number
): Promise<CalendarMonthPayload> {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(
    dayCountInMonth(year, month)
  ).padStart(2, "0")}`;

  const [
    userProfile,
    bills,
    cards,
    close,
    transferResult,
    savingsContributionResult,
    creditCardPaymentResult,
    billsBalanceResult,
  ] = await Promise.all([
    getUserProfileById(userId),
    listBillsForMonth(userId, year, month),
    listActiveCreditCards(userId),
    getMonthlyClose(userId, year, month),
    query<TransferRow>(
      `
        SELECT
          tg.id,
          tg.user_id,
          tg.transfer_date::text,
          tg.amount,
          tg.notes,
          tg.from_account_id,
          fa.name AS from_account_name,
          tg.to_account_id,
          ta.name AS to_account_name,
          tg.created_at::text
        FROM transfer_groups tg
        INNER JOIN accounts fa ON fa.id = tg.from_account_id
        INNER JOIN accounts ta ON ta.id = tg.to_account_id
        WHERE tg.user_id = $1
          AND tg.transfer_date >= $2::date
          AND tg.transfer_date <= $3::date
        ORDER BY tg.transfer_date ASC, tg.id ASC
      `,
      [userId, monthStart, monthEnd]
    ),
    query<{
      id: number;
      transaction_date: string;
      amount: number;
      description: string;
      notes: string | null;
    }>(
      `
        SELECT
          ct.id,
          ct.transaction_date::text,
          ct.amount,
          ct.description,
          ct.notes
        FROM cash_transactions ct
        INNER JOIN accounts a ON a.id = ct.account_id
        WHERE ct.user_id = $1
          AND ct.direction = 'inflow'
          AND a.account_purpose = 'savings'
          AND ct.transfer_group_id IS NULL
          AND ct.transaction_date >= $2::date
          AND ct.transaction_date <= $3::date
        ORDER BY ct.transaction_date ASC, ct.id ASC
      `,
      [userId, monthStart, monthEnd]
    ),
    query<{ card_id: number; amount_paid: number }>(
      `
        SELECT
          cc.id AS card_id,
          COALESCE(SUM(cct.amount), 0) AS amount_paid
        FROM credit_cards cc
        LEFT JOIN credit_card_transactions cct
          ON cct.card_id = cc.id
         AND cct.type = 'payment'
         AND cct.transaction_date >= $2::date
         AND cct.transaction_date <= $3::date
        WHERE cc.user_id = $1
          AND cc.active = TRUE
        GROUP BY cc.id
      `,
      [userId, monthStart, monthEnd]
    ),
    query<{ balance: number }>(
      `
        SELECT COALESCE(SUM(current_balance), 0) AS balance
        FROM accounts
        WHERE user_id = $1
          AND account_purpose = 'bills'
          AND is_active = TRUE
      `,
      [userId]
    ),
  ]);

  const cardPayments = creditCardPaymentResult.rows.reduce<Record<number, number>>(
    (summary, row) => {
      summary[row.card_id] = row.amount_paid;
      return summary;
    },
    {}
  );

  const billEvents: CalendarEvent[] = [];
  let totalScheduledBillObligations = 0;
  let remainingBillObligations = 0;

  for (const bill of bills) {
    const dueDates = getBillDueDatesForMonth(bill, year, month);
    if (dueDates.length === 0) {
      continue;
    }

    const scheduledAmount = bill.amount * dueDates.length;
    const amountPaid = bill.amount_paid ?? 0;
    const remainingAmount =
      bill.status === "paid" ? 0 : roundMoney(Math.max(bill.amount - amountPaid, 0));

    totalScheduledBillObligations += scheduledAmount;
    remainingBillObligations += remainingAmount * dueDates.length;

    for (const dueDate of dueDates) {
      const subtitleParts = [
        bill.category,
        bill.is_autopay ? "Autopay" : null,
        bill.status === "paid"
          ? "Fully paid"
          : amountPaid > 0
            ? `${formatCurrency(remainingAmount)} left`
            : null,
      ].filter((value): value is string => Boolean(value));

      billEvents.push({
        id: `bill-${bill.id}-${isoDate(dueDate)}`,
        date: isoDate(dueDate),
        type: "bill_due",
        title: bill.name,
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(" / ") : null,
        amount: bill.amount,
        status: bill.status ?? "scheduled",
      });
    }
  }

  const paydayAmount =
    userProfile && userProfile.monthly_income > 0 ? userProfile.monthly_income : null;
  const paydayEvents = userProfile
    ? getExpectedPaydaysForMonth(
        userProfile.pay_cycle,
        userProfile.last_paycheck_date,
        year,
        month
      ).map<CalendarEvent>((payday, index) => ({
        id: `payday-${isoDate(payday)}-${index}`,
        date: isoDate(payday),
        type: "payday",
        title: "Expected paycheck",
        subtitle: userProfile.pay_cycle.replace("-", " "),
        amount: paydayAmount,
        status: "expected",
      }))
    : [];

  const transferEvents = transferResult.rows.map<CalendarEvent>((transfer) => ({
    id: `transfer-${transfer.id}`,
    date: transfer.transfer_date,
    type: "transfer",
    title: `Transfer to ${transfer.to_account_name}`,
    subtitle: `From ${transfer.from_account_name}${
      transfer.notes ? ` / ${transfer.notes}` : ""
    }`,
    amount: transfer.amount,
    status: "recorded",
  }));

  const savingsContributionEvents = savingsContributionResult.rows.map<CalendarEvent>(
    (transaction) => ({
      id: `savings-${transaction.id}`,
      date: transaction.transaction_date,
      type: "savings_contribution",
      title: transaction.description || "Savings contribution",
      subtitle: transaction.notes,
      amount: transaction.amount,
      status: "recorded",
    })
  );

  const creditCardEvents: CalendarEvent[] = [];
  let totalScheduledCardMinimums = 0;
  let remainingScheduledCardMinimums = 0;

  for (const card of cards) {
    if (card.minimum_payment <= 0 || card.balance <= 0 || card.due_day <= 0) {
      continue;
    }

    totalScheduledCardMinimums += card.minimum_payment;
    const amountPaid = cardPayments[card.id] ?? 0;
    const remainingMinimum = roundMoney(
      Math.max(card.minimum_payment - amountPaid, 0)
    );
    remainingScheduledCardMinimums += remainingMinimum;

    creditCardEvents.push({
      id: `card-${card.id}-${year}-${month}`,
      date: isoDate(getCreditCardDueDateForMonth(card.due_day, year, month)),
      type: "credit_card_due",
      title: `${card.name} due`,
      subtitle:
        amountPaid > 0
          ? `${formatCurrency(amountPaid)} paid this month`
          : "Minimum payment scheduled",
      amount: card.minimum_payment,
      status:
        amountPaid >= card.minimum_payment
          ? "paid"
          : amountPaid > 0
            ? "partial"
            : "due",
    });
  }

  const events = sortCalendarEvents([
    ...paydayEvents,
    ...billEvents,
    ...creditCardEvents,
    ...transferEvents,
    ...savingsContributionEvents,
  ]);

  const totalScheduledObligations = roundMoney(
    totalScheduledBillObligations + totalScheduledCardMinimums
  );
  const scheduledObligations = roundMoney(
    remainingBillObligations + remainingScheduledCardMinimums
  );
  const billsAccountBalance = billsBalanceResult.rows[0]?.balance ?? 0;
  const availableAfterScheduled = roundMoney(
    billsAccountBalance - scheduledObligations
  );

  return {
    year,
    month,
    label: buildMonthLabel(year, month),
    events,
    summary: {
      billCount: billEvents.length,
      paydayCount: paydayEvents.length,
      transferCount: transferEvents.length,
      creditCardDueCount: creditCardEvents.length,
      savingsContributionCount: savingsContributionEvents.length,
    },
    funding: {
      billsAccountBalance,
      totalScheduledObligations,
      scheduledObligations,
      availableAfterScheduled,
      sufficiency: availableAfterScheduled >= 0 ? "covered" : "short",
    },
    close,
  };
}

export async function getBudgetVsActual(
  userId: number,
  months: number
): Promise<BudgetVsActualPayload> {
  const normalizedMonths = Math.max(1, Math.min(months, 24));

  const result = await query<BudgetVsActualRow>(
    `
      WITH months AS (
        SELECT
          month_start::date AS month_start,
          EXTRACT(YEAR FROM month_start)::int AS year,
          EXTRACT(MONTH FROM month_start)::int AS month_number,
          to_char(month_start, 'YYYY-MM') AS month,
          to_char(month_start, 'Mon YYYY') AS label
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - make_interval(months => $2::int - 1),
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) AS month_start
      ),
      budget_rows AS (
        SELECT
          m.month_start,
          mb.id AS budget_id,
          mb.created_at::text AS budget_created_at,
          mb.bills_budget,
          mb.disposable_budget,
          mb.savings_target,
          mb.extra_debt_payment_target
        FROM months m
        LEFT JOIN monthly_budgets mb
          ON mb.user_id = $1
         AND mb.year = m.year
         AND mb.month = m.month_number
      ),
      bill_actuals AS (
        SELECT
          m.month_start,
          COALESCE(SUM(
            CASE
              WHEN bp.amount_paid IS NOT NULL THEN bp.amount_paid
              WHEN bp.status = 'paid' THEN b.amount
              ELSE 0
            END
          ), 0) AS value
        FROM months m
        LEFT JOIN bill_payments bp
          ON date_trunc('month', COALESCE(bp.paid_at, make_date(bp.year, bp.month, 1))::timestamp)::date = m.month_start
        LEFT JOIN bills b
          ON b.id = bp.bill_id
         AND b.user_id = $1
        WHERE b.user_id = $1 OR b.user_id IS NULL
        GROUP BY m.month_start
      ),
      disposable_actuals AS (
        SELECT
          m.month_start,
          COALESCE(SUM(ct.amount), 0) AS value
        FROM months m
        LEFT JOIN cash_transactions ct
          ON date_trunc('month', ct.transaction_date::timestamp)::date = m.month_start
         AND ct.user_id = $1
         AND ct.direction = 'outflow'
         AND ct.transaction_kind = 'discretionary_spend'
        GROUP BY m.month_start
      ),
      savings_actuals AS (
        SELECT
          m.month_start,
          COALESCE(SUM(ct.amount), 0) AS value
        FROM months m
        LEFT JOIN cash_transactions ct
          ON date_trunc('month', ct.transaction_date::timestamp)::date = m.month_start
         AND ct.user_id = $1
         AND ct.direction = 'inflow'
        LEFT JOIN accounts a
          ON a.id = ct.account_id
         AND a.user_id = $1
        WHERE a.account_purpose = 'savings' OR a.account_purpose IS NULL
        GROUP BY m.month_start
      ),
      credit_card_payment_totals AS (
        SELECT
          m.month_start,
          cc.id AS card_id,
          COALESCE(cc.minimum_payment, 0) AS minimum_payment,
          COALESCE(SUM(cct.amount), 0) AS payment_total
        FROM months m
        LEFT JOIN credit_cards cc
          ON cc.user_id = $1
         AND cc.active = TRUE
        LEFT JOIN credit_card_transactions cct
          ON cct.card_id = cc.id
         AND cct.type = 'payment'
         AND date_trunc('month', cct.transaction_date::timestamp)::date = m.month_start
        GROUP BY m.month_start, cc.id, cc.minimum_payment
      ),
      credit_card_obligations AS (
        SELECT
          month_start,
          COALESCE(SUM(LEAST(payment_total, minimum_payment)), 0) AS minimums_paid,
          COALESCE(SUM(GREATEST(payment_total - minimum_payment, 0)), 0) AS extra_paid
        FROM credit_card_payment_totals
        GROUP BY month_start
      ),
      close_rows AS (
        SELECT
          m.month_start,
          mc.closed_at::text AS closed_at
        FROM months m
        LEFT JOIN monthly_closes mc
          ON mc.user_id = $1
         AND mc.year = m.year
         AND mc.month = m.month_number
      )
      SELECT
        m.month,
        m.label,
        m.year,
        m.month_number,
        br.budget_id,
        br.budget_created_at,
        br.bills_budget,
        br.disposable_budget,
        br.savings_target,
        br.extra_debt_payment_target,
        COALESCE(ba.value, 0) + COALESCE(cco.minimums_paid, 0) AS bills_actual,
        COALESCE(da.value, 0) AS disposable_actual,
        COALESCE(sa.value, 0) AS savings_actual,
        COALESCE(cco.extra_paid, 0) AS extra_debt_actual,
        cr.closed_at
      FROM months m
      LEFT JOIN budget_rows br ON br.month_start = m.month_start
      LEFT JOIN bill_actuals ba ON ba.month_start = m.month_start
      LEFT JOIN disposable_actuals da ON da.month_start = m.month_start
      LEFT JOIN savings_actuals sa ON sa.month_start = m.month_start
      LEFT JOIN credit_card_obligations cco ON cco.month_start = m.month_start
      LEFT JOIN close_rows cr ON cr.month_start = m.month_start
      ORDER BY m.month_start
    `,
    [userId, normalizedMonths]
  );

  const comparisons = result.rows.map((row) => {
    const budget =
      row.budget_id === null
        ? null
        : {
            id: row.budget_id,
            user_id: userId,
            year: row.year,
            month: row.month_number,
            bills_budget: row.bills_budget ?? 0,
            disposable_budget: row.disposable_budget ?? 0,
            savings_target: row.savings_target ?? 0,
            extra_debt_payment_target: row.extra_debt_payment_target ?? 0,
            created_at: row.budget_created_at ?? "",
          };

    const actuals = {
      bills: row.bills_actual,
      disposable: row.disposable_actual,
      savings: row.savings_actual,
      extraDebt: row.extra_debt_actual,
    };

    const variances = {
      bills: actuals.bills - (budget?.bills_budget ?? 0),
      disposable: actuals.disposable - (budget?.disposable_budget ?? 0),
      savings: actuals.savings - (budget?.savings_target ?? 0),
      extraDebt: actuals.extraDebt - (budget?.extra_debt_payment_target ?? 0),
    };

    return {
      month: row.month,
      label: row.label,
      year: row.year,
      monthNumber: row.month_number,
      budget,
      actuals,
      variances,
      plannedTotal: budget
        ? budget.bills_budget +
          budget.disposable_budget +
          budget.savings_target +
          budget.extra_debt_payment_target
        : null,
      actualTotal:
        actuals.bills +
        actuals.disposable +
        actuals.savings +
        actuals.extraDebt,
      monthStatus: row.closed_at ? "closed" : "open",
      closedAt: row.closed_at,
      insights: [],
    } satisfies Omit<BudgetVsActualComparison, "insights"> & { insights: string[] };
  });

  const hydratedComparisons = comparisons.map((comparison, index) => ({
    ...comparison,
    insights: buildBudgetInsights(
      comparison,
      index > 0 ? comparisons[index - 1] : null
    ),
  }));

  return {
    comparisons: hydratedComparisons,
  };
}

export async function getMonthlyTrends(
  userId: number,
  months: number
): Promise<TrendsPayload> {
  const normalizedMonths = Math.max(1, Math.min(months, 24));

  const monthSeriesSql = `
    WITH months AS (
      SELECT
        month_start::date AS month_start,
        to_char(month_start, 'YYYY-MM') AS month,
        to_char(month_start, 'Mon YYYY') AS label
      FROM generate_series(
        date_trunc('month', CURRENT_DATE) - make_interval(months => $2::int - 1),
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      ) AS month_start
    )
  `;

  const [billsPaid, disposableSpending, savingsContributions, creditCardPurchases, creditCardPayments, creditCardInterest, netOutflow] =
    await Promise.all([
      query<TrendPoint>(
        `
          ${monthSeriesSql}
          SELECT
            m.month,
            m.label,
            COALESCE(SUM(
              CASE
                WHEN bp.amount_paid IS NOT NULL THEN bp.amount_paid
                WHEN bp.status = 'paid' THEN b.amount
                ELSE 0
              END
            ), 0) AS value
          FROM months m
          LEFT JOIN bill_payments bp
            ON date_trunc('month', COALESCE(bp.paid_at, make_date(bp.year, bp.month, 1))::timestamp)::date = m.month_start
          LEFT JOIN bills b
            ON b.id = bp.bill_id
           AND b.user_id = $1
          WHERE b.user_id = $1 OR b.user_id IS NULL
          GROUP BY m.month, m.label, m.month_start
          ORDER BY m.month_start
        `,
        [userId, normalizedMonths]
      ),
      query<TrendPoint>(
        `
          ${monthSeriesSql}
          SELECT
            m.month,
            m.label,
            COALESCE(SUM(ct.amount), 0) AS value
          FROM months m
          LEFT JOIN cash_transactions ct
            ON date_trunc('month', ct.transaction_date::timestamp)::date = m.month_start
           AND ct.user_id = $1
           AND ct.direction = 'outflow'
           AND ct.transaction_kind = 'discretionary_spend'
          GROUP BY m.month, m.label, m.month_start
          ORDER BY m.month_start
        `,
        [userId, normalizedMonths]
      ),
      query<TrendPoint>(
        `
          ${monthSeriesSql}
          SELECT
            m.month,
            m.label,
            COALESCE(SUM(ct.amount), 0) AS value
          FROM months m
          LEFT JOIN cash_transactions ct
            ON date_trunc('month', ct.transaction_date::timestamp)::date = m.month_start
           AND ct.user_id = $1
           AND ct.direction = 'inflow'
          LEFT JOIN accounts a
            ON a.id = ct.account_id
           AND a.user_id = $1
          WHERE a.account_purpose = 'savings' OR a.account_purpose IS NULL
          GROUP BY m.month, m.label, m.month_start
          ORDER BY m.month_start
        `,
        [userId, normalizedMonths]
      ),
      query<TrendPoint>(
        `
          ${monthSeriesSql}
          SELECT
            m.month,
            m.label,
            COALESCE(SUM(cct.amount), 0) AS value
          FROM months m
          LEFT JOIN credit_card_transactions cct
            ON date_trunc('month', cct.transaction_date::timestamp)::date = m.month_start
           AND cct.type = 'purchase'
          LEFT JOIN credit_cards cc
            ON cc.id = cct.card_id
           AND cc.user_id = $1
          WHERE cc.user_id = $1 OR cc.user_id IS NULL
          GROUP BY m.month, m.label, m.month_start
          ORDER BY m.month_start
        `,
        [userId, normalizedMonths]
      ),
      query<TrendPoint>(
        `
          ${monthSeriesSql}
          SELECT
            m.month,
            m.label,
            COALESCE(SUM(cct.amount), 0) AS value
          FROM months m
          LEFT JOIN credit_card_transactions cct
            ON date_trunc('month', cct.transaction_date::timestamp)::date = m.month_start
           AND cct.type = 'payment'
          LEFT JOIN credit_cards cc
            ON cc.id = cct.card_id
           AND cc.user_id = $1
          WHERE cc.user_id = $1 OR cc.user_id IS NULL
          GROUP BY m.month, m.label, m.month_start
          ORDER BY m.month_start
        `,
        [userId, normalizedMonths]
      ),
      query<TrendPoint>(
        `
          ${monthSeriesSql}
          SELECT
            m.month,
            m.label,
            COALESCE(SUM(cct.amount), 0) AS value
          FROM months m
          LEFT JOIN credit_card_transactions cct
            ON date_trunc('month', cct.transaction_date::timestamp)::date = m.month_start
           AND cct.type = 'interest'
          LEFT JOIN credit_cards cc
            ON cc.id = cct.card_id
           AND cc.user_id = $1
          WHERE cc.user_id = $1 OR cc.user_id IS NULL
          GROUP BY m.month, m.label, m.month_start
          ORDER BY m.month_start
        `,
        [userId, normalizedMonths]
      ),
      query<TrendPoint>(
        `
          ${monthSeriesSql},
          bills AS (
            SELECT
              m.month_start,
              COALESCE(SUM(
                CASE
                  WHEN bp.amount_paid IS NOT NULL THEN bp.amount_paid
                  WHEN bp.status = 'paid' THEN b.amount
                  ELSE 0
                END
              ), 0) AS value
            FROM months m
            LEFT JOIN bill_payments bp
              ON date_trunc('month', COALESCE(bp.paid_at, make_date(bp.year, bp.month, 1))::timestamp)::date = m.month_start
            LEFT JOIN bills b
              ON b.id = bp.bill_id
             AND b.user_id = $1
            WHERE b.user_id = $1 OR b.user_id IS NULL
            GROUP BY m.month_start
          ),
          disposable AS (
            SELECT
              m.month_start,
              COALESCE(SUM(ct.amount), 0) AS value
            FROM months m
            LEFT JOIN cash_transactions ct
              ON date_trunc('month', ct.transaction_date::timestamp)::date = m.month_start
             AND ct.user_id = $1
             AND ct.direction = 'outflow'
             AND ct.transaction_kind = 'discretionary_spend'
            GROUP BY m.month_start
          ),
          savings AS (
            SELECT
              m.month_start,
              COALESCE(SUM(ct.amount), 0) AS value
            FROM months m
            LEFT JOIN cash_transactions ct
              ON date_trunc('month', ct.transaction_date::timestamp)::date = m.month_start
             AND ct.user_id = $1
             AND ct.direction = 'inflow'
            LEFT JOIN accounts a
              ON a.id = ct.account_id
             AND a.user_id = $1
            WHERE a.account_purpose = 'savings' OR a.account_purpose IS NULL
            GROUP BY m.month_start
          ),
          cc_payments AS (
            SELECT
              m.month_start,
              COALESCE(SUM(cct.amount), 0) AS value
            FROM months m
            LEFT JOIN credit_card_transactions cct
              ON date_trunc('month', cct.transaction_date::timestamp)::date = m.month_start
             AND cct.type = 'payment'
            LEFT JOIN credit_cards cc
              ON cc.id = cct.card_id
             AND cc.user_id = $1
            WHERE cc.user_id = $1 OR cc.user_id IS NULL
            GROUP BY m.month_start
          )
          SELECT
            m.month,
            m.label,
            COALESCE(b.value, 0) + COALESCE(d.value, 0) + COALESCE(s.value, 0) + COALESCE(cp.value, 0) AS value
          FROM months m
          LEFT JOIN bills b ON b.month_start = m.month_start
          LEFT JOIN disposable d ON d.month_start = m.month_start
          LEFT JOIN savings s ON s.month_start = m.month_start
          LEFT JOIN cc_payments cp ON cp.month_start = m.month_start
          ORDER BY m.month_start
        `,
        [userId, normalizedMonths]
      ),
    ]);

  return {
    billsPaidByMonth: mapTrendRows(billsPaid.rows),
    disposableSpendingByMonth: mapTrendRows(disposableSpending.rows),
    savingsContributionsByMonth: mapTrendRows(savingsContributions.rows),
    creditCardPurchasesByMonth: mapTrendRows(creditCardPurchases.rows),
    creditCardPaymentsByMonth: mapTrendRows(creditCardPayments.rows),
    creditCardInterestByMonth: mapTrendRows(creditCardInterest.rows),
    netOutflowByMonth: mapTrendRows(netOutflow.rows),
  };
}

export async function listAccounts(userId: number): Promise<AccountRow[]> {
  const result = await query<AccountRow>(
    `
      SELECT
        id,
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active,
        plaid_account_id,
        created_at::text
      FROM accounts
      WHERE user_id = $1
        AND is_active = TRUE
      ORDER BY ${accountOrderingClause()}
    `,
    [userId]
  );

  return result.rows;
}

export async function getAccountById(
  userId: number,
  accountId: number,
  options?: { client?: PoolClient; forUpdate?: boolean }
): Promise<AccountRow | null> {
  return getAccountByIdInternal(
    options?.client ?? queryable(),
    userId,
    accountId,
    { forUpdate: options?.forUpdate }
  );
}

export async function createAccount(
  userId: number,
  input: {
    name: string;
    institution_name?: string | null;
    last_four?: string | null;
    account_type: AccountType;
    account_purpose: AccountPurpose;
    current_balance?: number;
    is_manual?: boolean;
  }
): Promise<AccountRow | null> {
  const account = await one<AccountRow>(
    queryable(),
    `
      INSERT INTO accounts (
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING
        id,
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active,
        plaid_account_id,
        created_at::text
    `,
    [
      userId,
      input.name,
      input.institution_name ?? null,
      input.last_four ?? null,
      input.account_type,
      input.account_purpose,
      input.current_balance ?? 0,
      input.is_manual ?? true,
    ]
  );

  if (account?.account_purpose === "savings") {
    await syncUserSavingsFromAccounts(queryable(), userId);
  }

  return account;
}

export async function updateAccount(
  userId: number,
  accountId: number,
  input: {
    name: string;
    institution_name?: string | null;
    last_four?: string | null;
    account_type: AccountType;
    account_purpose: AccountPurpose;
    current_balance: number;
  }
): Promise<AccountRow | null> {
  const account = await one<AccountRow>(
    queryable(),
    `
      UPDATE accounts
      SET
        name = $1,
        institution_name = $2,
        last_four = $3,
        account_type = $4,
        account_purpose = $5,
        current_balance = $6
      WHERE id = $7
        AND user_id = $8
      RETURNING
        id,
        user_id,
        name,
        institution_name,
        last_four,
        account_type,
        account_purpose,
        current_balance,
        is_manual,
        is_active,
        plaid_account_id,
        created_at::text
    `,
    [
      input.name,
      input.institution_name ?? null,
      input.last_four ?? null,
      input.account_type,
      input.account_purpose,
      input.current_balance,
      accountId,
      userId,
    ]
  );

  if (account) {
    await syncUserSavingsFromAccounts(queryable(), userId);
  }

  return account;
}

export async function deactivateAccount(
  userId: number,
  accountId: number
): Promise<void> {
  const account = await getAccountById(userId, accountId);
  if (!account) {
    return;
  }

  await query(
    `
      UPDATE accounts
      SET is_active = FALSE
      WHERE id = $1
        AND user_id = $2
    `,
    [accountId, userId]
  );

  if (account.account_purpose === "savings") {
    await syncUserSavingsFromAccounts(queryable(), userId);
  }
}

export async function listCashTransactions(
  userId: number,
  limit = 50
): Promise<CashTransactionRow[]> {
  const result = await query<CashTransactionRow>(
    `
      SELECT
        ct.id,
        ct.user_id,
        ct.account_id,
        a.name AS account_name,
        a.account_purpose,
        ct.transaction_date::text,
        ct.amount,
        ct.direction,
        ct.category,
        ct.merchant_name,
        ct.description,
        ct.transaction_kind,
        ct.linked_bill_id,
        ct.transfer_group_id,
        ct.notes,
        ct.created_at::text
      FROM cash_transactions ct
      INNER JOIN accounts a ON a.id = ct.account_id
      WHERE ct.user_id = $1
      ORDER BY ct.transaction_date DESC, ct.id DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows;
}

export async function getCashTransactionById(
  userId: number,
  transactionId: number,
  options?: { client?: PoolClient; forUpdate?: boolean }
): Promise<CashTransactionRecordRow | null> {
  const lockingClause = options?.forUpdate ? " FOR UPDATE" : "";

  return one<CashTransactionRecordRow>(
    options?.client ?? queryable(),
    `
      SELECT
        id,
        user_id,
        account_id,
        transaction_date::text,
        amount,
        direction,
        category,
        merchant_name,
        description,
        transaction_kind,
        linked_bill_id,
        transfer_group_id,
        notes,
        created_at::text
      FROM cash_transactions
      WHERE id = $1
        AND user_id = $2
      ${lockingClause}
    `,
    [transactionId, userId]
  );
}

export async function createCashTransaction(
  userId: number,
  input: {
    account_id: number;
    transaction_date: string;
    amount: number;
    direction: CashDirection;
    category?: string | null;
    merchant_name?: string | null;
    description: string;
    transaction_kind: CashTransactionKind;
    linked_bill_id?: number | null;
    notes?: string | null;
  }
): Promise<CashTransactionRow | null> {
  return withTransaction(async (client) => {
    const account = await getAccountById(userId, input.account_id, {
      client,
      forUpdate: true,
    });
    if (!account || !account.is_active) {
      return null;
    }

    const transaction = await one<CashTransactionRecordRow>(
      client,
      `
        INSERT INTO cash_transactions (
          user_id,
          account_id,
          transaction_date,
          amount,
          direction,
          category,
          merchant_name,
          description,
          transaction_kind,
          linked_bill_id,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
          id,
          user_id,
          account_id,
          transaction_date::text,
          amount,
          direction,
          category,
          merchant_name,
          description,
          transaction_kind,
          linked_bill_id,
          transfer_group_id,
          notes,
          created_at::text
      `,
      [
        userId,
        input.account_id,
        input.transaction_date,
        input.amount,
        input.direction,
        input.category ?? null,
        input.merchant_name ?? null,
        input.description,
        input.transaction_kind,
        input.linked_bill_id ?? null,
        input.notes ?? null,
      ]
    );

    await adjustAccountBalance(
      client,
      userId,
      input.account_id,
      signedAmount(input.direction, input.amount)
    );

    if (!transaction) {
      return null;
    }

    return one<CashTransactionRow>(
      client,
      `
        SELECT
          ct.id,
          ct.user_id,
          ct.account_id,
          a.name AS account_name,
          a.account_purpose,
          ct.transaction_date::text,
          ct.amount,
          ct.direction,
          ct.category,
          ct.merchant_name,
          ct.description,
          ct.transaction_kind,
          ct.linked_bill_id,
          ct.transfer_group_id,
          ct.notes,
          ct.created_at::text
        FROM cash_transactions ct
        INNER JOIN accounts a ON a.id = ct.account_id
        WHERE ct.id = $1
      `,
      [transaction.id]
    );
  });
}

export async function updateCashTransaction(
  userId: number,
  transactionId: number,
  input: {
    account_id: number;
    transaction_date: string;
    amount: number;
    direction: CashDirection;
    category?: string | null;
    merchant_name?: string | null;
    description: string;
    transaction_kind: CashTransactionKind;
    linked_bill_id?: number | null;
    notes?: string | null;
  }
): Promise<CashTransactionRow | null> {
  return withTransaction(async (client) => {
    const existing = await getCashTransactionById(userId, transactionId, {
      client,
      forUpdate: true,
    });
    if (!existing) {
      return null;
    }

    if (existing.transfer_group_id) {
      throw new Error("TRANSFER_TRANSACTION_IMMUTABLE");
    }

    await getAccountById(userId, existing.account_id, {
      client,
      forUpdate: true,
    });
    await adjustAccountBalance(
      client,
      userId,
      existing.account_id,
      -signedAmount(existing.direction, existing.amount)
    );

    const nextAccount = await getAccountById(userId, input.account_id, {
      client,
      forUpdate: true,
    });
    if (!nextAccount || !nextAccount.is_active) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }

    const updated = await one<CashTransactionRecordRow>(
      client,
      `
        UPDATE cash_transactions
        SET
          account_id = $1,
          transaction_date = $2,
          amount = $3,
          direction = $4,
          category = $5,
          merchant_name = $6,
          description = $7,
          transaction_kind = $8,
          linked_bill_id = $9,
          notes = $10
        WHERE id = $11
          AND user_id = $12
        RETURNING
          id,
          user_id,
          account_id,
          transaction_date::text,
          amount,
          direction,
          category,
          merchant_name,
          description,
          transaction_kind,
          linked_bill_id,
          transfer_group_id,
          notes,
          created_at::text
      `,
      [
        input.account_id,
        input.transaction_date,
        input.amount,
        input.direction,
        input.category ?? null,
        input.merchant_name ?? null,
        input.description,
        input.transaction_kind,
        input.linked_bill_id ?? null,
        input.notes ?? null,
        transactionId,
        userId,
      ]
    );

    await adjustAccountBalance(
      client,
      userId,
      input.account_id,
      signedAmount(input.direction, input.amount)
    );

    if (!updated) {
      return null;
    }

    return one<CashTransactionRow>(
      client,
      `
        SELECT
          ct.id,
          ct.user_id,
          ct.account_id,
          a.name AS account_name,
          a.account_purpose,
          ct.transaction_date::text,
          ct.amount,
          ct.direction,
          ct.category,
          ct.merchant_name,
          ct.description,
          ct.transaction_kind,
          ct.linked_bill_id,
          ct.transfer_group_id,
          ct.notes,
          ct.created_at::text
        FROM cash_transactions ct
        INNER JOIN accounts a ON a.id = ct.account_id
        WHERE ct.id = $1
      `,
      [updated.id]
    );
  });
}

export async function deleteCashTransaction(
  userId: number,
  transactionId: number
): Promise<void> {
  await withTransaction(async (client) => {
    const existing = await getCashTransactionById(userId, transactionId, {
      client,
      forUpdate: true,
    });
    if (!existing) {
      return;
    }

    if (existing.transfer_group_id) {
      throw new Error("TRANSFER_TRANSACTION_IMMUTABLE");
    }

    await getAccountById(userId, existing.account_id, {
      client,
      forUpdate: true,
    });
    await adjustAccountBalance(
      client,
      userId,
      existing.account_id,
      -signedAmount(existing.direction, existing.amount)
    );

    await client.query(
      `
        DELETE FROM cash_transactions
        WHERE id = $1
          AND user_id = $2
      `,
      [transactionId, userId]
    );
  });
}

export async function listTransfers(
  userId: number,
  limit = 25
): Promise<TransferRow[]> {
  const result = await query<TransferRow>(
    `
      SELECT
        tg.id,
        tg.user_id,
        tg.transfer_date::text,
        tg.amount,
        tg.notes,
        tg.from_account_id,
        fa.name AS from_account_name,
        tg.to_account_id,
        ta.name AS to_account_name,
        tg.created_at::text
      FROM transfer_groups tg
      INNER JOIN accounts fa ON fa.id = tg.from_account_id
      INNER JOIN accounts ta ON ta.id = tg.to_account_id
      WHERE tg.user_id = $1
      ORDER BY tg.transfer_date DESC, tg.id DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows;
}

export async function createTransfer(
  userId: number,
  input: {
    from_account_id: number;
    to_account_id: number;
    transfer_date: string;
    amount: number;
    notes?: string | null;
  }
): Promise<TransferRow | null> {
  return withTransaction(async (client) => {
    const fromAccount = await getAccountById(userId, input.from_account_id, {
      client,
      forUpdate: true,
    });
    const toAccount = await getAccountById(userId, input.to_account_id, {
      client,
      forUpdate: true,
    });

    if (
      !fromAccount ||
      !toAccount ||
      !fromAccount.is_active ||
      !toAccount.is_active ||
      fromAccount.id === toAccount.id
    ) {
      return null;
    }

    const transfer = await one<TransferRow>(
      client,
      `
        INSERT INTO transfer_groups (
          user_id,
          transfer_date,
          from_account_id,
          to_account_id,
          amount,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          user_id,
          transfer_date::text,
          amount,
          notes,
          from_account_id,
          '' AS from_account_name,
          to_account_id,
          '' AS to_account_name,
          created_at::text
      `,
      [
        userId,
        input.transfer_date,
        input.from_account_id,
        input.to_account_id,
        input.amount,
        input.notes ?? null,
      ]
    );

    if (!transfer) {
      return null;
    }

    await client.query(
      `
        INSERT INTO cash_transactions (
          user_id,
          account_id,
          transaction_date,
          amount,
          direction,
          category,
          merchant_name,
          description,
          transaction_kind,
          transfer_group_id,
          notes
        )
        VALUES
          ($1, $2, $3, $4, 'outflow', 'Transfer', NULL, $5, 'transfer', $6, $7),
          ($1, $8, $3, $4, 'inflow', 'Transfer', NULL, $9, 'transfer', $6, $7)
      `,
      [
        userId,
        input.from_account_id,
        input.transfer_date,
        input.amount,
        `Transfer to ${toAccount.name}`,
        transfer.id,
        input.notes ?? null,
        input.to_account_id,
        `Transfer from ${fromAccount.name}`,
      ]
    );

    await adjustAccountBalance(
      client,
      userId,
      input.from_account_id,
      -input.amount
    );
    await adjustAccountBalance(
      client,
      userId,
      input.to_account_id,
      input.amount
    );

    return one<TransferRow>(
      client,
      `
        SELECT
          tg.id,
          tg.user_id,
          tg.transfer_date::text,
          tg.amount,
          tg.notes,
          tg.from_account_id,
          fa.name AS from_account_name,
          tg.to_account_id,
          ta.name AS to_account_name,
          tg.created_at::text
        FROM transfer_groups tg
        INNER JOIN accounts fa ON fa.id = tg.from_account_id
        INNER JOIN accounts ta ON ta.id = tg.to_account_id
        WHERE tg.id = $1
      `,
      [transfer.id]
    );
  });
}
