# Site Monitor

A lightweight static-site monitor built natively on SpaceFast. Checks all of
Demo's sites every 5 minutes and serves a small status dashboard.

## What it checks per site

- **Uptime**: HTTP status (follows redirects), 20s timeout per site
- **Response time**: measured per check, slow responses flagged on the sparkline
- **Content changes**: SHA-256 of the body; a change vs the previous check is flagged
- **SSL expiry**: via crt.sh, warns under 30 days, alerts under 14 days

## Architecture

- `functions/api/cron/check.ts` — cron target (`*/5 * * * *` in sf.jsonc), runs
  the full pass via `functions/_core/runner.ts`
- `functions/api/sites.ts` — GET: sites + latest check + 24h uptime %
- `functions/api/history.ts` — GET `?site=<id>&hours=24`: recent points for sparklines
- `functions/api/check-now.ts` — POST: run a pass on demand
- `functions/_core/checker.ts` — probe logic (fetch, hash, crt.sh)
- `functions/_core/db.ts` — schema (`sites`, `checks`) + seed list
- `public/index.html` — dashboard (vanilla JS, auto-refresh 60s)

History is pruned to 30 days. Dashboard is `noindex, nofollow`.

## Deploy

```bash
./scripts/publish.sh [space] [message]   # default space: site-monitor
```

## SpaceFast notes

- `runtime.fetch: true` is required for outbound checks (hand-written handlers
  don't get it by default).
- MySQL-shaped DB: `VARCHAR(n)` for PK/indexed columns (learned from FreshInk).
