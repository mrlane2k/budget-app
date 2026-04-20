CREATE TABLE IF NOT EXISTS monthly_budgets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  bills_budget NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (bills_budget >= 0),
  disposable_budget NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (disposable_budget >= 0),
  savings_target NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (savings_target >= 0),
  extra_debt_payment_target NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (extra_debt_payment_target >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_budgets_user_period
  ON monthly_budgets (user_id, year DESC, month DESC);
