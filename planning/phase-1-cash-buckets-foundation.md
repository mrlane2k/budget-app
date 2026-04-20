# Phase 1: Cash Buckets Foundation

## Goal

Model the real money system directly inside the app:

- `Bills Checking`
- `Disposable Checking`
- `Savings`
- `Credit Cards`

This phase creates the structure needed to track disposable spending separately from bill spending.

## Why This Phase Comes First

Without bucket-aware tracking, later reporting and Plaid sync would flatten all checking activity together and make the app less useful than your real-world process.

## Scope

Build:

- account/bucket model
- manual cash transaction entry
- manual transfer entry
- account management UI

Do not build yet:

- charts
- Plaid
- automatic reconciliation

## Data Model

### New table: `accounts`

Fields:

- `id`
- `user_id`
- `name`
- `institution_name` nullable
- `account_type` (`checking`, `savings`, `credit_card`)
- `account_purpose` (`bills`, `disposable`, `savings`, `credit_card`)
- `current_balance` nullable
- `is_manual`
- `is_active`
- `plaid_account_id` nullable
- `created_at`

### New table: `cash_transactions`

Fields:

- `id`
- `user_id`
- `account_id`
- `transaction_date`
- `amount`
- `direction` (`inflow`, `outflow`)
- `category`
- `merchant_name` nullable
- `description`
- `transaction_kind` (`bill_payment`, `discretionary_spend`, `transfer`, `income`, `savings_contribution`, `adjustment`)
- `linked_bill_id` nullable
- `transfer_group_id` nullable
- `notes` nullable
- `created_at`

### New table: `transfer_groups`

Fields:

- `id`
- `user_id`
- `transfer_date`
- `from_account_id`
- `to_account_id`
- `amount`
- `notes` nullable
- `created_at`

## API Work

Add:

- `GET/POST /api/accounts`
- `PUT/DELETE /api/accounts/[id]`
- `GET/POST /api/cash-transactions`
- `PUT/DELETE /api/cash-transactions/[id]`
- `GET/POST /api/transfers`

## UI Work

Build:

- accounts settings screen
- add/edit account form
- add cash transaction form
- add transfer form
- account list with current balances

## Product Rules

- bill payments from `Bills Checking` count as bill spending
- purchases from `Disposable Checking` count as disposable spending
- transfer to `Savings` is not spending
- transfer from `Disposable Checking` to `Bills Checking` is not spending

## Acceptance Criteria

- user can create the three main checking/savings buckets
- user can record a discretionary purchase against `Disposable Checking`
- user can record a bill payment against `Bills Checking`
- user can record a transfer between accounts
- transfers do not affect spending totals

## Dependencies

- existing auth
- existing Postgres migration pattern

## Risks

- if the category model is too narrow now, later Plaid mapping gets messy
- if transfers are not first-class, reports will double count cash movement
