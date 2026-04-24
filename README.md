# Budget App

Budget App is a personal finance tracker built around a Tauri desktop shell, React UI, and an encrypted local database. It supports recurring bills, monthly payment tracking, credit-card balances, manual ledger entries, cash buckets, calendar review, and dashboard summaries for planning cash flow.

## What Changed

- the live app now runs through Tauri commands instead of Next.js API routes
- desktop data is stored in an encrypted local SQLite/SQLCipher database with the key protected by the OS credential store
- a one-time setup flow replaces old seeded credentials, and desktop session state replaces hosted cookie auth
- GitHub Actions can build desktop release artifacts for macOS, Windows, and Linux
- the old hosted/home-server runtime path has been removed from the active codebase

Implementation notes and follow-up items live in [`NOTES.md`](./NOTES.md).

Forward-looking product planning lives in [`planning/README.md`](./planning/README.md).

## Stack

- Next.js `16.2.0`
- React `19.2.4`
- TypeScript
- Tailwind CSS `4`
- Tauri `2`
- Rust
- SQLCipher-backed SQLite for desktop storage
- GitHub Actions

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start the desktop app:

```bash
npm run desktop:dev
```

3. Open `/setup` if the local desktop vault is empty, otherwise sign in at `/login`.

`npm run dev` still starts the Next.js shell, but the migrated app now expects to run inside Tauri. Use the desktop command above for normal development and smoke testing.

## Desktop Development

The repo now includes an initial Tauri desktop shell under [`src-tauri`](./src-tauri).

Current status:

- `npm run desktop:dev` is the supported development runtime for the migrated app
- `npm run desktop:info` reports the local Tauri and system environment
- `npm run desktop:build` now packages the current desktop-native pages by materializing a static `dist/` from the prerendered Next build output before Tauri bundles the app
- the frontend now talks directly to Tauri `invoke()` for all migrated screens; the old Next.js API route layer has been removed from the live runtime path
- bills, cash buckets, credit cards, trends, budget, calendar, setup, login, settings, and vault controls now use the same desktop-native transport and encrypted local database
- the app now runs against a local SQLite database in the desktop app data directory with in-process session state on the Rust side
- the local database key is generated separately and stored in the OS credential store; the database file itself is now created as an encrypted local store for the native desktop slice
- the desktop app can now optionally wrap that database key behind a separate vault passphrase, with unlock and relock flows wired through the login and settings screens
- the settings screen can also rotate the underlying SQLCipher database key without changing the rest of the app data
- if an earlier plaintext desktop prototype database is present in the app data directory, the setup screen can import it into the encrypted store

In other words, the desktop shell is now the real app runtime, and the current production bundle path is good enough to keep producing release artifacts while we continue removing legacy hosted-era code.

## Desktop Releases

GitHub Releases for desktop builds are handled by [`.github/workflows/release-desktop.yml`](./.github/workflows/release-desktop.yml).

- push a tag like `app-v1.0.0` to build release assets on macOS, Windows, and Linux
- or run the workflow manually from GitHub Actions and provide the tag name
- the workflow publishes the release once all platform bundles finish successfully
- bundle targets are platform-specific:
  - macOS: `.dmg` plus an updater archive
  - Windows: NSIS installer
  - Linux: `.deb` and `.AppImage`

Code-signing and updater secrets can be layered on later. The checked-in workflow already passes `TAURI_PRIVATE_KEY` and `TAURI_KEY_PASSWORD` through if you add them as repository secrets.

## Legacy Hosted Notes

The old Postgres-backed API layer and home-server deployment path have now been removed from the active codebase. The remaining release and development workflows are desktop-first.
