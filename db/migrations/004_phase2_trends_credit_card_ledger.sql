ALTER TABLE credit_card_transactions
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE credit_card_transactions
ADD COLUMN IF NOT EXISTS merchant_name TEXT;

ALTER TABLE credit_card_transactions
ADD COLUMN IF NOT EXISTS source_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE credit_card_transactions
DROP CONSTRAINT IF EXISTS credit_card_transactions_type_check;

ALTER TABLE credit_card_transactions
ADD CONSTRAINT credit_card_transactions_type_check
CHECK (type IN ('purchase', 'payment', 'interest', 'fee', 'adjustment'));

CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_card_type_date
  ON credit_card_transactions (card_id, type, transaction_date DESC, id DESC);
