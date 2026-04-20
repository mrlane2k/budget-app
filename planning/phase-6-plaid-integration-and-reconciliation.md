# Phase 6: Plaid Integration and Reconciliation

## Goal

Pull checking, savings, and credit-card data automatically while preserving the manual planning workflow.

## Scope

Build:

- Plaid Link flow
- item/account storage
- transaction sync
- webhook processing
- reconciliation UI
- account-to-bucket mapping

## Plaid Products

Primary:

- `Transactions`
- `transactions/sync`

Secondary:

- `Accounts`
- optional `Balance`
- optional `Liabilities`

## Data Model

Add:

- `plaid_items`
- `plaid_accounts`
- `plaid_transactions`
- `plaid_sync_cursors`
- `plaid_webhook_events`

## Sync Model

1. Create Link token.
2. User connects accounts.
3. Exchange `public_token` for `access_token`.
4. Store item and account metadata.
5. Run initial `transactions/sync`.
6. Save cursor.
7. On `SYNC_UPDATES_AVAILABLE`, fetch incremental changes.

## UI Work

Build:

- account connection flow
- linked account management
- imported transaction review
- manual-to-imported reconciliation
- unmatched transactions view

## Product Rules

- imported data starts read-only
- balances may inform the UI, but manual budgeting data remains authoritative until reconciliation is confirmed
- `Bills Checking`, `Disposable Checking`, and `Savings` each need explicit Plaid account mapping

## Acceptance Criteria

- user can connect checking, savings, and card accounts
- imported transactions land in app storage successfully
- imported accounts can be mapped to bucket purposes
- the user can reconcile imported transactions against manual bill and spending records
- disposable spending trends can be powered from real bank/card data

## Dependencies

- Phase 5 transaction and reconciliation foundation

## Risks

- institution re-auth and item health issues
- duplicate data if matching is weak
- false matches between recurring bills and imported transactions

## Rollout Strategy

### First release

- link accounts
- import transactions
- show trends
- no automatic write-back into bills or budgets

### Later release

- recurring bill suggestions
- automatic match proposals
- optional balance refresh improvements
