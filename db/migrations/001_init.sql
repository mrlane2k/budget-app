CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  pay_cycle TEXT NOT NULL DEFAULT 'bi-weekly',
  last_paycheck_date DATE,
  monthly_income NUMERIC(12, 2) NOT NULL DEFAULT 0,
  current_savings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  extra_cc_payment NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bills (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  due_day INTEGER NOT NULL DEFAULT 1,
  due_date DATE,
  is_autopay BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id BIGSERIAL PRIMARY KEY,
  bill_id BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid',
  amount_paid NUMERIC(12, 2),
  paid_at TIMESTAMPTZ,
  UNIQUE (bill_id, year, month)
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  minimum_payment NUMERIC(12, 2) NOT NULL DEFAULT 0,
  apr NUMERIC(6, 2) NOT NULL DEFAULT 0,
  due_day INTEGER NOT NULL,
  last_four TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_card_transactions (
  id BIGSERIAL PRIMARY KEY,
  card_id BIGINT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payment', 'interest')),
  amount NUMERIC(12, 2) NOT NULL,
  note TEXT,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_user_active
  ON bills (user_id, active);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_period
  ON bill_payments (bill_id, year, month);

CREATE INDEX IF NOT EXISTS idx_credit_cards_user_active
  ON credit_cards (user_id, active);

CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_card_date
  ON credit_card_transactions (card_id, transaction_date DESC, id DESC);
