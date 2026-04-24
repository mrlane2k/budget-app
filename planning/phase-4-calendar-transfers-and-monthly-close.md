# Phase 4: Calendar, Transfers, and Monthly Close

Status: completed in the desktop app.

## Goal

Make timing and review visible:

- when money moves
- when bills are due
- when paychecks arrive
- when a month is complete and trusted

## Scope

Build:

- cash flow calendar
- transfer visibility
- monthly close workflow
- month status tracking

## UI Work

### Cash Flow Calendar

Show:

- bill due dates
- expected paydays
- transfers between accounts
- credit-card due dates
- major savings contributions

### Monthly Close

Checklist:

- bills reviewed
- transfers reviewed
- disposable spending reviewed
- card balances/payments reviewed
- month marked closed

## Data Model

Possible additions:

- `monthly_closes`
- `monthly_close_notes`

Suggested `monthly_closes` fields:

- `id`
- `user_id`
- `year`
- `month`
- `closed_at`
- `notes` nullable

## Runtime Work

Add:

- desktop-native `get_calendar_month` command
- desktop-native `save_monthly_close` command

## Product Rules

- closed months should be treated as reviewed, not immutable
- reopening a month should be possible
- `Bills Checking` should be evaluable for funding sufficiency inside the calendar view

## Acceptance Criteria

- user can see expected and actual cash movement on a calendar
- user can review and close a month
- the app can distinguish open vs closed months in reports

## Dependencies

- Phases 1 through 3

## Risks

- date logic can get messy around non-monthly bills
- if paycheck timing is not modeled carefully, the calendar can look less trustworthy than the simpler dashboards
