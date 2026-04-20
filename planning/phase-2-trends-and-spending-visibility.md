# Phase 2: Trends and Spending Visibility

## Goal

Show month-over-month trends for the spending patterns that matter:

- bills paid
- disposable spending
- savings contributions
- credit-card purchases
- credit-card payments
- credit-card interest

## Scope

Build:

- a dedicated `Trends` page
- monthly aggregation queries
- filters for last 6 months and 12 months
- clear bucket-aware summaries

Do not build yet:

- budget targets
- Plaid import
- automatic recommendations

## Data Work

Use:

- `bill_payments` for bills paid
- `cash_transactions` for disposable spending, income, transfers, savings contributions
- `credit_card_transactions` for card activity

Extend `credit_card_transactions` to support:

- `purchase`
- `payment`
- `interest`
- `fee`
- `adjustment`

Optional new fields:

- `category`
- `merchant_name`
- `source_account_id`

## API Work

Add:

- `GET /api/trends`

Suggested output sections:

- `billsPaidByMonth`
- `disposableSpendingByMonth`
- `savingsContributionsByMonth`
- `creditCardPurchasesByMonth`
- `creditCardPaymentsByMonth`
- `creditCardInterestByMonth`
- `netOutflowByMonth`

## UI Work

Build:

- trends landing page
- top-line month-over-month cards
- simple charts for each section
- filters for date range

## Product Rules

- card payments are debt payoff, not purchase spend
- transfers should appear in transfer reporting but not in spend totals
- bills and disposable spending should never be combined in a single unlabeled total

## Acceptance Criteria

- user can see monthly bill spending trends
- user can see monthly disposable spending trends
- user can see monthly card purchase vs payment trends separately
- trend math is bucket-aware and non-duplicative

## Dependencies

- Phase 1 accounts and cash transactions
- extension of credit-card ledger entry types

## Risks

- existing historical data may be partial for disposable spending before this phase
- charts can mislead if transfers are accidentally treated as outflow
