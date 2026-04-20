ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS last_four TEXT;

ALTER TABLE accounts
DROP CONSTRAINT IF EXISTS accounts_last_four_format;

ALTER TABLE accounts
ADD CONSTRAINT accounts_last_four_format
CHECK (last_four IS NULL OR last_four ~ '^[0-9]{4}$');
