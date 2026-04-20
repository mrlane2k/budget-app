CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution_name TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card')),
  account_purpose TEXT NOT NULL CHECK (account_purpose IN ('bills', 'disposable', 'savings', 'credit_card')),
  current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_manual BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  plaid_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_groups (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transfer_date DATE NOT NULL,
  from_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_account_id <> to_account_id)
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  category TEXT,
  merchant_name TEXT,
  description TEXT NOT NULL,
  transaction_kind TEXT NOT NULL CHECK (
    transaction_kind IN (
      'bill_payment',
      'discretionary_spend',
      'transfer',
      'income',
      'savings_contribution',
      'adjustment'
    )
  ),
  linked_bill_id BIGINT REFERENCES bills(id) ON DELETE SET NULL,
  transfer_group_id BIGINT REFERENCES transfer_groups(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_active
  ON accounts (user_id, is_active, account_purpose);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_plaid_account_id
  ON accounts (plaid_account_id)
  WHERE plaid_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transfer_groups_user_date
  ON transfer_groups (user_id, transfer_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_user_date
  ON cash_transactions (user_id, transaction_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_account_date
  ON cash_transactions (account_id, transaction_date DESC, id DESC);

INSERT INTO accounts (
  user_id,
  name,
  account_type,
  account_purpose,
  current_balance,
  is_manual,
  is_active
)
SELECT
  seed.user_id,
  seed.name,
  seed.account_type,
  seed.account_purpose,
  seed.current_balance,
  TRUE,
  TRUE
FROM (
  SELECT
    u.id AS user_id,
    'Bills Checking'::TEXT AS name,
    'checking'::TEXT AS account_type,
    'bills'::TEXT AS account_purpose,
    0::NUMERIC(12, 2) AS current_balance
  FROM users u
  UNION ALL
  SELECT
    u.id,
    'Disposable Checking'::TEXT,
    'checking'::TEXT,
    'disposable'::TEXT,
    0::NUMERIC(12, 2)
  FROM users u
  UNION ALL
  SELECT
    u.id,
    'Savings'::TEXT,
    'savings'::TEXT,
    'savings'::TEXT,
    u.current_savings
  FROM users u
) AS seed
WHERE NOT EXISTS (
  SELECT 1
  FROM accounts a
  WHERE a.user_id = seed.user_id
);
