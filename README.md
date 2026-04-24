# Budget App

Budget App is a personal finance tracker built with Next.js, React, Tailwind CSS, and Postgres. It supports recurring bills, monthly payment tracking, credit-card balances, manual ledger entries, and dashboard summaries for planning cash flow.

The app now runs as stateless application code plus an external database so it can deploy cleanly to a Linux home server today and stay portable to Vercel later.

## What Changed

- SQLite and `better-sqlite3` were replaced with Postgres via `pg`
- database schema migrations now live in [`db/migrations`](./db/migrations)
- a one-time setup flow replaces the old default seeded credentials
- auth cookies and JWT secret handling are environment-driven
- GitHub Actions CI and self-hosted home-server deployment workflows are checked in
- the credit-card ledger balance bug was fixed so new entries apply only their own delta

Implementation notes and follow-up items live in [`NOTES.md`](./NOTES.md).

Forward-looking product planning lives in [`planning/README.md`](./planning/README.md).

## Stack

- Next.js `16.2.0`
- React `19.2.4`
- TypeScript
- Tailwind CSS `4`
- Postgres via `pg`
- `bcryptjs`
- `jsonwebtoken`
- GitHub Actions
- Caddy reverse proxy for home-server deployment

## Runtime Configuration

The app uses environment-driven runtime configuration:

```env
DATABASE_URL=postgres://user:password@host:5432/budget_app?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
APP_BASE_PATH=/budget
APP_ORIGIN=https://home.laneworks.org
PORT=3004
COOKIE_SECURE=true
```

Notes:

- `APP_BASE_PATH` matters at build time because Next.js `basePath` is compiled into the app
- `JWT_SECRET` is required outside development
- `COOKIE_SECURE=true` should stay enabled for TLS-backed production
- for a future Vercel deploy, you can reuse the same Postgres database and change only environment values

See [`.env.example`](./.env.example) for the template used by deployment.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Set environment variables. For root-path local development, use values like:

```env
DATABASE_URL=postgres://...
JWT_SECRET=replace-with-a-long-random-secret
APP_BASE_PATH=
APP_ORIGIN=http://localhost:3000
PORT=3000
COOKIE_SECURE=false
```

3. Apply migrations:

```bash
npm run db:migrate
```

4. Start the app:

```bash
npm run dev
```

5. Open `/setup` if the database is empty, otherwise sign in at `/login`.

## Desktop Development

The repo now includes an initial Tauri desktop shell under [`src-tauri`](./src-tauri).

Current status:

- `npm run desktop:dev` is wired to the existing Next.js dev server for local desktop development
- `npm run desktop:info` reports the local Tauri and system environment
- `npm run desktop:build` now packages the current desktop-native pages by materializing a static `dist/` from the prerendered Next build output before Tauri bundles the app
- the frontend now auto-switches to Tauri `invoke()` inside the desktop shell for the setup, login, settings, and bills slice
- credit cards and cash buckets now use the same desktop-native transport and encrypted local database
- that slice now runs against a local SQLite database in the desktop app data directory with in-process session state on the Rust side
- the local database key is generated separately and stored in the OS credential store; the database file itself is now created as an encrypted local store for the native desktop slice
- the desktop app can now optionally wrap that database key behind a separate vault passphrase, with unlock and relock flows wired through the login and settings screens
- the settings screen can also rotate the underlying SQLCipher database key without changing the rest of the app data
- if an earlier plaintext desktop prototype database is present in the app data directory, the setup screen can import it into the encrypted store
- the rest of the app is still mid-migration, so reporting-heavy screens may continue using the existing web-style paths until their native command slices are implemented

In other words, the desktop shell is ready to develop against now, and the current production bundle path is good enough to start producing release artifacts while the remaining reporting screens are still being migrated.

## Desktop Releases

GitHub Releases for desktop builds are handled by [`.github/workflows/release-desktop.yml`](./.github/workflows/release-desktop.yml).

- push a tag like `app-v0.1.0` to build release assets on macOS, Windows, and Linux
- or run the workflow manually from GitHub Actions and provide the tag name
- the workflow currently creates a draft release so the generated bundles can be reviewed before publishing
- bundle targets are platform-specific:
  - macOS: `.app`
  - Windows: `.msi` and NSIS installer
  - Linux: `.deb` and `.AppImage`

Code-signing and updater secrets can be layered on later. The checked-in workflow already passes `TAURI_PRIVATE_KEY` and `TAURI_KEY_PASSWORD` through if you add them as repository secrets.

## Home-Server Deployment

The checked-in production target remains:

- public URL: `https://home.laneworks.org/budget`
- reverse proxy: Caddy
- app process: `systemd`
- deployment: GitHub Actions self-hosted runner on the Linux server

Deployment assets:

- workflow: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
- workflow: [`.github/workflows/deploy-home.yml`](./.github/workflows/deploy-home.yml)
- bootstrap docs: [`deploy/README.md`](./deploy/README.md)
- `systemd` unit: [`deploy/systemd/budget-app.service`](./deploy/systemd/budget-app.service)
- Caddy snippet: [`deploy/caddy/budget-app.Caddyfile`](./deploy/caddy/budget-app.Caddyfile)

## Migrating Existing SQLite Data

If you have an existing `budget.db`, import it into Postgres once:

```bash
npm run db:migrate
npm run db:import-sqlite -- --sqlite /path/to/budget.db
```

The importer preserves:

- users
- bills
- bill payments
- credit cards
- credit-card transactions

## Other Scripts

Import rolling averages for variable bills from the CSV template:

```bash
node scripts/import-bill-history.js bill-history-template.csv
```

## Future Vercel Path

The repo is not deploying to Vercel yet, but the main blockers are gone:

- no local writable SQLite dependency
- environment-driven base path and origin
- Postgres-backed persistence
- async route handler data access

Turning on Vercel later should be a hosting/configuration step rather than another storage rewrite.
