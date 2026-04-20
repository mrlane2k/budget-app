# Project Notes

## Status

Updated: 2026-04-12

This repo is now aligned with the deployment plan:

- Postgres is the source of truth
- runtime configuration is environment-driven
- first-run setup replaces default credentials
- GitHub Actions handles CI plus home-server deployment
- the app stays compatible with `/budget` hosting while remaining portable to future Vercel deployment

## Implemented In This Pass

### Data and persistence

- Replaced SQLite access with a shared async Postgres layer in [`lib/db.ts`](./lib/db.ts) and [`lib/data.ts`](./lib/data.ts).
- Added checked-in Postgres schema migrations in [`db/migrations`](./db/migrations).
- Added a one-time SQLite import path in [`scripts/import-sqlite-to-postgres.mjs`](./scripts/import-sqlite-to-postgres.mjs).
- Updated the bill-history import helper to use `DATABASE_URL`.

### Auth and setup

- Removed the implicit default admin bootstrap.
- Added setup endpoints:
  - [`app/api/setup/status/route.ts`](./app/api/setup/status/route.ts)
  - [`app/api/setup/route.ts`](./app/api/setup/route.ts)
- Added the first-run UI at [`app/setup/page.tsx`](./app/setup/page.tsx).
- Hardened cookie behavior and JWT secret loading in [`lib/auth.ts`](./lib/auth.ts) and [`lib/config.ts`](./lib/config.ts).

### Deployment and portability

- Added CI in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).
- Added self-hosted deployment in [`.github/workflows/deploy-home.yml`](./.github/workflows/deploy-home.yml).
- Added home-server bootstrap artifacts under [`deploy`](./deploy).
- Moved base-path handling to environment-driven config so the app can run at `/budget` now and be adapted later without code edits.

### Financial correctness

- Fixed credit-card ledger writes so each new entry applies only its own payment/interest delta.
- Stopped replaying historical ledger entries from an already-mutated stored balance.

## Remaining Risks and Follow-Up Work

### 1. Validation coverage is still light

The app now has CI for lint and production build, but there is still no dedicated test suite for financial calculations or route behavior. The next highest-value additions would be automated checks around:

- bill normalization and dashboard totals
- credit-card payment summary calculations
- auth-protected route behavior
- setup flow lockout after the first user is created

### 2. Bills summary consistency still needs a pass

The dashboard and bills screens do not yet clearly share one normalization model for non-monthly bills. This is a product correctness issue, just lower priority than the ledger bug that was fixed here.

### 3. Some UI copy still deserves cleanup

The rough encoding issues were reduced in the touched files, but a broader plain-text polish pass across the rest of the interface would still be worthwhile.

### 4. Vercel is ready in architecture, not enabled operationally

The codebase no longer depends on local SQLite files, which removes the main hosting blocker. Vercel deployment still needs:

- project setup in Vercel
- production env values in Vercel
- a decision on whether Vercel should serve from `/budget` or `/`

## Recommended Next Steps

1. Add targeted tests for payoff math, bill totals, and setup/auth behavior.
2. Do one deploy rehearsal on the Linux home server with a fresh Postgres database.
3. Run a second rehearsal using the SQLite import script against a copy of real data.
4. Decide whether the eventual Vercel deployment should keep `/budget` or use the root path.
5. Clean up remaining UI text inconsistencies after the deployment path is stable.
