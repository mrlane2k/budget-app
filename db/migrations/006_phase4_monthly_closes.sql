CREATE TABLE IF NOT EXISTS monthly_closes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  bills_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  transfers_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  disposable_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  credit_cards_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_closes_user_period
  ON monthly_closes (user_id, year DESC, month DESC);
