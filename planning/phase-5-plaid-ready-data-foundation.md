# Phase 5: Plaid-Ready Data Foundation

## Goal

Prepare the app for imported bank and card data without forcing a rewrite later.

This phase is about internal discipline, not external integration yet.

## Scope

Build:

- transaction categories and rules
- account mapping structure
- reconciliation helpers
- normalized transaction model for future imported data

Do not build yet:

- Plaid Link
- webhooks
- automatic sync jobs

## Data Model

Extend or add:

- stable transaction categories
- merchant normalization
- matching rules
- optional link fields between manual records and imported records

Possible tables:

- `transaction_rules`
- `reconciliation_matches`

## UI Work

Build:

- category management
- merchant-to-category rules
- bill matching suggestions
- transaction review helpers

## Product Rules

- manual and imported data should coexist
- imported transactions should not silently overwrite manual records
- reconciliation should be review-first

## Acceptance Criteria

- manual transactions use a structure that future imported transactions can also use
- rules can classify common merchants or recurring charges
- the app can support matching imported bill payments to manual bills later

## Dependencies

- Phases 1 through 4

## Risks

- weak category rules will create noisy Plaid imports later
- if manual and imported records are not clearly separated, users will lose trust fast
