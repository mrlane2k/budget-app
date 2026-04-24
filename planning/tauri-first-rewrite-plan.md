# Tauri-First Rewrite Plan

This roadmap moved the app from a hosted Next.js + Postgres deployment shape to a locally installable desktop app built with Tauri and encrypted SQLite.

## Goals

- keep the existing budgeting workflows and UI concepts
- remove the dependency on a hosted Node.js server
- replace browser-only auth/session assumptions with desktop-local session handling
- move persistence to a local SQLite database in the app data directory
- produce installable builds for macOS, Windows, and Linux

## Current Status

The desktop-first runtime is now the real app:

- the live user flows run through Tauri commands in `src-tauri/src/commands.rs`
- the old `app/api/*` route layer has been removed from the active runtime path
- the legacy Postgres-backed `lib/data` and `lib/db` layers have been removed
- desktop packaging is wired through GitHub Releases

What remains is cleanup, polish, and deeper desktop-native hardening rather than the original runtime migration.

## Migration Phases

### Phase 1: Extract service boundaries

- move validation and orchestration out of `app/api/*`
- keep route handlers as thin wrappers
- create shared error types usable by both HTTP handlers and future Tauri commands

Status: completed and superseded by the native command layer.

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

Status: completed, then removed as part of the desktop-only cleanup.

### Phase 3: Introduce storage abstractions

- define repository interfaces around the current data operations
- keep the Postgres implementation temporarily
- add tests around the domain services before swapping storage engines

Status: partially skipped in favor of moving the desktop commands directly onto a native SQLite layer.

### Phase 4: Add SQLite storage

- create a SQLite schema and migration flow
- store the database file in the desktop app data directory
- implement SQLite-backed repositories
- verify reporting queries for:
  - calendar
  - trends
  - budget vs actual

Status: completed, with SQLCipher-style encrypted local storage and OS keychain protection.

### Phase 5: Replace browser auth with desktop session flow

- remove JWT cookie assumptions
- replace `/api/auth/*` with local session or unlock state
- keep first-run setup, but make it desktop-local

Status: completed.

### Phase 6: Add Tauri shell and commands

- scaffold `src-tauri/`
- convert route-level operations into Tauri commands
- replace frontend `fetch('/api/...')` calls with typed command calls

Status: completed for the app’s current surfaces.

### Phase 7: Move the frontend off the Next runtime

- preserve React components and styling where possible
- remove the need for Next route handlers and server config
- decide whether to:
  - keep a static-exported Next frontend temporarily, or
  - move fully to a Vite + React frontend

Recommended end state: Vite + React inside Tauri.

Status: partially complete. The app still uses the Next app shell for rendering, but it no longer depends on Next route handlers or hosted auth/runtime assumptions.

### Phase 8: Packaging and distribution

- add CI build matrix for macOS, Windows, and Linux
- configure installers and code signing per platform
- optionally add in-app updates later

Status: active and working for release artifacts; code signing and updater work remain optional follow-up.

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

The next best moves are now:

1. tighten desktop-only UX and command boundaries
2. reduce stale planning and hosted-era references in docs/UI
3. decide whether the remaining Next shell should stay as a packaging bridge or move to Vite
