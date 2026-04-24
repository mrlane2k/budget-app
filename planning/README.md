# Planning Roadmap

This folder breaks the next product roadmap into separate implementation phases.

Current status:

- Phases 1 through 4 are now implemented in the desktop app.
- Phases 5 and 6 are still forward-looking Plaid/import planning.

The app is being planned around four money buckets:

- `Bills Checking`
- `Disposable Checking`
- `Savings`
- `Credit Cards`

That model is intentional. The goal is not just to track spending, but to track spending by purpose so the app can separate:

- obligated bill spending
- flexible disposable spending
- savings growth and reserves
- debt and credit-card activity

## Phase Index

- [Phase 1: Cash Buckets Foundation](./phase-1-cash-buckets-foundation.md) - completed
- [Phase 2: Trends and Spending Visibility](./phase-2-trends-and-spending-visibility.md) - completed
- [Phase 3: Budget vs Actual](./phase-3-budget-vs-actual.md) - completed
- [Phase 4: Calendar, Transfers, and Monthly Close](./phase-4-calendar-transfers-and-monthly-close.md) - completed
- [Phase 5: Plaid-Ready Data Foundation](./phase-5-plaid-ready-data-foundation.md)
- [Phase 6: Plaid Integration and Reconciliation](./phase-6-plaid-integration-and-reconciliation.md)

## Recommended Delivery Order

1. Build bucket-aware manual tracking first.
2. Add trends and reporting next.
3. Layer in budget-vs-actual and monthly planning.
4. Add calendar and monthly close workflow.
5. Prepare the schema and transaction model for imported bank data.
6. Add Plaid only after the app has a stable internal accounting model.

## Guiding Rules

- `Bills Checking` and `Disposable Checking` should never be collapsed into one generic cash bucket.
- Transfers should be visible, but not counted as spending.
- Credit-card purchases and credit-card payments must remain separate metrics.
- Plaid should start as read-only import plus reconciliation, not silent auto-overwrite.
- Manual workflows should remain usable even before Plaid exists.
