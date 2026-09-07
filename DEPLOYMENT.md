# Deployment Guide — WordbitX Clinic Platform

Fixes the classic production failure:

```
Error occurred prerendering page "/sitemap.xml"
error: relation "blog_posts" does not exist (42P01)
```

## Why it happened

1. `/sitemap.xml` was **statically prerendered at build time** and queried
   `blog_posts` / `doctors` during `next build`.
2. On Vercel / Hostinger the `DATABASE_URL` pointed at a **fresh Supabase
   database where no tables existed yet** (migrations were never applied).
3. Build-time DB access + missing tables = prerender crash.

## What was fixed

| Fix | Where | Effect |
| --- | --- | --- |
| Sitemap is now **dynamic** (`export const dynamic = "force-dynamic"`) | `src/app/sitemap.ts` | No DB query during `next build`; sitemap generated per-request |
| Sitemap degrades gracefully if DB is momentarily unreachable (logs the error, still serves core URLs) | `src/app/sitemap.ts` | Sitemap never 500s |
| **Auto-migration on server start** (idempotent `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` + indexes for all 12 tables) | `src/instrumentation.ts` → `src/db/bootstrap.ts` → `src/db/migrate.ts` | A brand-new Supabase/Postgres DB becomes fully usable on first boot — no manual step |
| Optional demo seed (only when DB is empty) | `src/db/bootstrap.ts` (`SEED_DEMO_DATA`, default on; set `SEED_DEMO_DATA=false` for a clean DB) | Demo content appears on fresh installs only |
| Manual SQL for review/audit | `supabase/schema.sql` | Paste into Supabase SQL Editor if you prefer manual migrations |

No other page queries the database at build time (all DB-backed pages are
`force-dynamic`), so no other prerender can fail this way.

## Deploy to Vercel

1. Create a Supabase project → **Connect → Connection string (Session pooler, port 5432)**.
   Copy the `postgresql://postgres.…@aws-0-….pooler.supabase.com:5432/postgres` string.
2. Vercel → Project → Settings → Environment Variables → add:
   - `DATABASE_URL` = the session-pooler string above
   - `NEXT_PUBLIC_SITE_URL` = your production domain (used for sitemap/canonicals)
   - optional: `SEED_DEMO_DATA=false` for an empty production database
   - optional: `GOOGLE_SITE_VERIFICATION` for Search Console
3. Deploy. On first cold start the instrumentation hook creates every table.
4. (Optional, manual path) Instead of step 3's auto-migration, open Supabase →
   SQL Editor, paste `supabase/schema.sql`, run once.
5. Verify: open `https://your-domain/sitemap.xml` and `/api/health`.

## Deploy to Hostinger (Node app)

Same environment variables (`DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, optional
`SEED_DEMO_DATA`). Build command `npm run build`, start command
`npm run start`. Because the sitemap is dynamic, the build no longer touches
the database at all.

### If Hostinger shows "This page couldn't load / A server error occurred"

That page means the Node process crashed at boot or the first request 500'd.
Check in this order:

1. **Environment variables are set in the Hostinger panel** (not only in
   Vercel!). Hostinger → your Node app → Environment variables:
   - `DATABASE_URL` = Supabase connection string
   - `NEXT_PUBLIC_SITE_URL` = `https://your-domain`
   Then **stop and start** the app (env changes need a restart).
2. **Node.js version ≥ 20** (Next.js 16 requires Node 20.9+). In the
   Hostinger Node app settings pick Node 20 or 22, then rebuild.
3. **Start command** must be `npm run start` (runs `next start` on `$PORT`).
4. **Supabase connection string**: use the **Session pooler** string
   (port 5432). If you used the transaction pooler (port 6543), the app
   automatically appends `pgbouncer=true`. SSL is enabled automatically for
   `*.supabase.co` hosts.
5. **Diagnose live**: open `https://your-domain/api/health`.
   - `{"ok":true,"database":"connected"}` → DB is fine, look elsewhere.
   - `503 {"status":"database_unreachable","detail":"…"}` → the `detail`
     field contains the exact Postgres error (missing env var, wrong
     password, SSL, pooler…). The same message is printed in Hostinger logs
     at boot as `[boot] Database bootstrap failed: …`.
   The server now stays alive even with a broken DB so this endpoint and the
   logs always tell you the real cause instead of a generic host error page.

## Notes on Supabase connection modes

- **Session pooler (port 5432)** works out of the box with this `pg` Pool.
- If you must use the **transaction pooler (port 6543)**, keep statements
  simple (this app does) — or prefer session mode to avoid prepared-statement
  issues under PgBouncer transaction mode.

## Tables created automatically

`clinic_settings`, `users`, `doctors`, `services`, `patients`,
`appointments`, `leads`, `reviews`, `blog_posts`, `faqs`,
`patient_accounts`, `otp_codes` (+ indexes & unique constraints).
