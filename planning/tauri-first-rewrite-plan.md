# Tauri-First Rewrite Plan

This roadmap moves the app from a hosted Next.js + Postgres deployment shape to a locally installable desktop app built with Tauri and SQLite.

## Goals

- keep the existing budgeting workflows and UI concepts
- remove the dependency on a hosted Node.js server
- replace browser-only auth/session assumptions with desktop-local session handling
- move persistence to a local SQLite database in the app data directory
- produce installable builds for macOS, Windows, and Linux

## Current Status

The current codebase already has a useful split:

- UI pages live in `app/*.tsx`
- route handlers live in `app/api/*`
- most data access lives in `lib/data.ts`

That makes the first migration step straightforward: extract reusable application services so route handlers stop being the main home for business logic.

## Migration Phases

### Phase 1: Extract service boundaries

- move validation and orchestration out of `app/api/*`
- keep route handlers as thin wrappers
- create shared error types usable by both HTTP handlers and future Tauri commands

Initial slice already started:

- setup
- auth login
- settings
- bills

### Phase 2: Split `lib/data.ts` by domain

- create domain-oriented modules for:
  - users and setup
  - bills
  - credit cards
  - accounts and cash transactions
  - budget, calendar, trends, and monthly close
- keep SQL behavior unchanged while the modules are split

### Phase 3: Introduce storage abstractions

- define repository interfaces around the current data operations
- keep the Postgres implementation temporarily
- add tests around the domain services before swapping storage engines

### Phase 4: Add SQLite storage

- create a SQLite schema and migration flow
- store the database file in the desktop app data directory
- implement SQLite-backed repositories
- verify reporting queries for:
  - calendar
  - trends
  - budget vs actual

### Phase 5: Replace browser auth with desktop session flow

- remove JWT cookie assumptions
- replace `/api/auth/*` with local session or unlock state
- keep first-run setup, but make it desktop-local

### Phase 6: Add Tauri shell and commands

- scaffold `src-tauri/`
- convert route-level operations into Tauri commands
- replace frontend `fetch('/api/...')` calls with typed command calls

### Phase 7: Move the frontend off the Next runtime

- preserve React components and styling where possible
- remove the need for Next route handlers and server config
- decide whether to:
  - keep a static-exported Next frontend temporarily, or
  - move fully to a Vite + React frontend

Recommended end state: Vite + React inside Tauri.

### Phase 8: Packaging and distribution

- add CI build matrix for macOS, Windows, and Linux
- configure installers and code signing per platform
- optionally add in-app updates later

## Suggested Port Order

To reduce risk, port in this order:

1. setup and login
2. settings
3. bills
4. accounts, cash transactions, and transfers
5. credit cards
6. trends
7. budget vs actual
8. calendar and monthly close

This order gets the local app foundation working before the read-model-heavy reporting screens.

## Next Slice

After the initial service extraction, the next best move is:

1. split `lib/data.ts` into domain-specific modules without changing behavior
2. scaffold repository interfaces for the extracted services
3. prepare a Tauri app shell once the first 2-3 domains are no longer route-driven
