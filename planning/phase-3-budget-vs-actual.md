# Phase 3: Budget vs Actual

Status: completed in the desktop app.

## Goal

Compare planned monthly behavior against actual outcomes.

This phase is where the app becomes a real planning tool instead of only a tracker.

## Scope

Build:

- monthly budget targets
- budget-vs-actual page/section
- variance reporting
- monthly summary insights

## Data Model

### New table: `monthly_budgets`

Fields:

- `id`
- `user_id`
- `year`
- `month`
- `bills_budget`
- `disposable_budget`
- `savings_target`
- `extra_debt_payment_target`

Unique constraint:

- `user_id`, `year`, `month`

## Runtime Work

Add:

- desktop-native monthly budget create/update commands
- desktop-native `get_budget_vs_actual` command

## UI Work

Build:

- monthly budget editor
- actual vs target comparison cards
- per-category variance summaries
- “what changed this month” summary

Suggested comparisons:

- bills budget vs actual bills paid
- disposable budget vs actual discretionary spend
- savings target vs actual savings contributions
- extra debt target vs actual card payments above minimums

## Product Rules

- missed savings target should show as a shortfall, not spending
- extra credit-card payment target should be separate from regular bills
- disposable overspend should be highlighted clearly

## Acceptance Criteria

- user can set monthly targets
- user can see over/under results by month
- user can distinguish planned obligations from flexible spending
- user can review shortfalls in savings or debt goals

## Dependencies

- Phase 1 transaction foundation
- Phase 2 trends aggregation

## Risks

- if actuals are incomplete, budget-vs-actual can look inaccurate
- if bill normalization and monthly bill logic remain inconsistent, this phase will expose it
