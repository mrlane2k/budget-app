# Home Server Deployment

## Directory layout

- App checkout: `/srv/budget-app/app`
- Runtime env file: `/etc/budget-app/budget-app.env`
- Systemd service: `budget-app`

## First-time bootstrap

1. Copy [`deploy/systemd/budget-app.service`](./systemd/budget-app.service) to `/etc/systemd/system/budget-app.service`.
2. Copy [`deploy/caddy/budget-app.Caddyfile`](./caddy/budget-app.Caddyfile) into your Caddy config and reload Caddy.
3. Create `/etc/budget-app/budget-app.env` from [`.env.example`](../.env.example).
   Required values: `DATABASE_URL`, `JWT_SECRET`, `APP_BASE_PATH`, `APP_ORIGIN`, `PORT`.
4. Install a self-hosted GitHub Actions runner on the Linux server.
5. Ensure the runner user can restart the app service with passwordless `sudo systemctl restart budget-app`.
6. Run `sudo systemctl daemon-reload`.
7. Enable the service after the first successful deploy: `sudo systemctl enable budget-app`.

## First deploy

1. Push the repo to GitHub.
2. Let the `Deploy Home Server` workflow run on the self-hosted runner.
3. Open `https://home.laneworks.org/budget/setup` to create the first admin account if the database is empty.

## Existing SQLite data

If you want to preserve the legacy SQLite data:

1. Configure `DATABASE_URL` in the server env file.
2. Run `npm run db:migrate`.
3. Run `npm run db:import-sqlite -- --sqlite /path/to/budget.db`.
4. Remove or archive the old SQLite files after you verify the import.

## Future Vercel deployment

This repo is now structured so a later Vercel deployment can reuse the same Postgres database. The remaining work for Vercel should be provider setup plus environment configuration, not another persistence rewrite.
