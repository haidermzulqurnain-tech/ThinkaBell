# Hostinger Node.js Deployment Guide

This guide details how to deploy the **ThinkaBell** Next.js 15+ application to Hostinger Node.js hosting.

---

## Architecture on Hostinger

Next.js can build in **standalone mode** (`output: "standalone"` in `next.config.js`, enabled by `pnpm build:standalone`). This builds a self-contained Node.js server containing only the production dependencies needed to run the website.

`next build` with `output: "standalone"` emits only the server runtime — it does **not** copy the client assets (`.next/static`) or `public/` files. `pnpm build:standalone` therefore copies them into the standalone output (`scripts/lib/standalone-assets.js`, shared with `pnpm package:hostinger`), so both deploy layouts are complete: the repository layout (native Hostinger integration) and the packaged bundle (`dist/hostinger-deploy/`).

---

## Step-by-Step Deployment Walkthrough

### Step 1: Build the Standalone Bundle Locally

```bash
# In the root repository
pnpm install
pnpm package:hostinger   # builds with OUTPUT=standalone (cross-platform) and packages dist/hostinger-deploy/
```

`pnpm package:hostinger` runs two steps: `pnpm build:standalone` (production build with `output: "standalone"`, injecting `OUTPUT=standalone` into the build environment so it works identically on Windows, macOS, and Linux) and `node scripts/prepare-hostinger.js` (copies the standalone runtime, `.next/static` chunks, `public/` assets, and `hostinger-server.js` into `dist/hostinger-deploy/`).

**Windows note:** the standalone output requires symlink support — enable Developer Mode (Settings → Privacy & security → For developers) or run from an elevated terminal. The build fails fast with guidance if symlinks are unavailable; alternatively deploy the full project and run `next start`.

This compiles the application and packages all standalone server files, `.next/static` CSS/JS chunks, and `public/` assets into:
`dist/hostinger-deploy/`

---

### Step 2: Configure Hostinger hPanel

Hostinger auto-detects the framework as **Next.js** — **override it to `Other`**. Hostinger's Next.js mode applies `output: "standalone"` itself and then starts the bundled server from the standard single-app layout (`.next/standalone/server.js`). This monorepo emits the standalone server at `apps/web/.next/standalone/apps/web/server.js`, which that mode cannot locate. The deterministic configuration uses the **Other** application type with the repository's own entrypoint:

| Setting              | Value                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Application type** | `Other`                        | Runs our entrypoint instead of Hostinger's Next.js-mode server start, which expects the standard (non-monorepo) standalone layout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Node version**     | `22.x`                         | Matches the `engines.node` field in `package.json` and the CI runners.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Root directory**   | `./`                           | Must stay the repository root: the automatic `pnpm install` needs the workspace root (`pnpm-workspace.yaml`) to resolve the `workspace:*` dependencies. Hostinger's monorepo auto-detection would pick `apps/web` and build only that subdirectory, which breaks the workspace install.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Build command**    | `pnpm run build:standalone`    | Injects `OUTPUT=standalone` cross-platform and copies `.next/static` + `public/` into the standalone output. A plain `pnpm run build` (turbo) does **not** emit `.next/standalone`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Package manager**  | `pnpm`                         | **Set this explicitly in hPanel — it is not auto-detected.** The _version_ is pinned by the `packageManager` field in the root `package.json` (currently `pnpm@10.34.6`); `pnpm-workspace.yaml` sets `pmOnFail: warn` and `verifyDepsBeforeRun: warn`, so a host whose `pnpm` shim resolves to a newer version (e.g. 11.x) **logs the mismatch and continues** instead of aborting. The automatic `pnpm install` and the build then run under the same pnpm, which keeps `node_modules` in one layout rather than the mixed 10/11 layout that was breaking the workspace. If the setting is left on the default (`npm`), the automatic install runs `npm install`, which does not read `pnpm-workspace.yaml`: only the root devDependencies are installed and every workspace package (including `apps/web`) is left without `node_modules`, so the build fails with `next: command not found`. |
| **Output directory** | _(leave empty)_                | Ignored for `Other` when an entry file is set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Entry file**       | `apps/web/hostinger-server.js` | Relative to the root directory. Resolves the standalone server at `apps/web/.next/standalone/apps/web/server.js`, binds the `PORT` Hostinger assigns, and falls back to `next start` when no standalone build exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

With these settings the native GitHub integration runs the full pipeline on Hostinger: `pnpm install` (automatic) → `pnpm run build:standalone` → `node apps/web/hostinger-server.js`. No manual upload is needed — push to `main` and Hostinger rebuilds.

---

### Step 3: Manual upload (fallback)

The native GitHub integration (Step 2) builds on Hostinger directly, so no upload is needed. Use this fallback only if the native integration is unavailable (e.g. the GitHub App cannot access the repo):

1. Run `pnpm package:hostinger` (requires symlink support — on Windows, enable Developer Mode).
2. Compress the contents of `dist/hostinger-deploy/` into a `.zip` file.
3. In Hostinger **File Manager**, upload the zip to your **Application Root** (`public_html`) and extract it.

The deployable files are the **built standalone bundle** in `dist/hostinger-deploy/` — **not** the raw repository files. The raw repo (source code, `package.json`, `apps/`, `packages/`, `scripts/`) cannot run on Hostinger: it has no `node_modules` and no `.next/standalone` build output, so `hostinger-server.js` cannot start.

---

### Step 4: Configure Environment Variables in Hostinger

In the Hostinger Node.js control panel (**Environment** section), add the variables below. Values marked **generate** are created by you with `openssl rand -hex 32` (two different values for `ENCRYPTION_KEY` and `BLIND_INDEX_KEY`). Values marked **console** come from the named provider's dashboard.

**Core (required for a healthy `/api/health`):**

| Variable                        | Source                                    | Description                                                            |
| ------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `NODE_ENV`                      | —                                         | `production`                                                           |
| `PORT`                          | —                                         | Leave unset; Hostinger assigns the port dynamically                    |
| `NEXT_PUBLIC_APP_URL`           | —                                         | `https://thinkabell.click` — drives unsubscribe links and `utm_source` |
| `SUPABASE_URL`                  | Supabase console (Project Settings → API) | Project URL                                                            |
| `SUPABASE_ANON_KEY`             | Supabase console                          | Public anon key                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase console                          | Secret key — server-side only, never browser-exposed                   |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase console                          | Same as `SUPABASE_URL` (browser-facing)                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase console                          | Same as `SUPABASE_ANON_KEY` (browser-facing)                           |
| `UPSTASH_REDIS_REST_URL`        | Upstash console                           | Redis REST URL                                                         |
| `UPSTASH_REDIS_REST_TOKEN`      | Upstash console                           | Redis REST token                                                       |

**Security (required — endpoints fail closed without them):**

| Variable                 | Source                     | Description                                                        |
| ------------------------ | -------------------------- | ------------------------------------------------------------------ |
| `CRON_SECRET`            | generate                   | Bearer token authorizing `/api/cron/*`                             |
| `ALERTS_API_KEY`         | generate                   | Bearer token authorizing `/api/alerts`                             |
| `REVALIDATION_SECRET`    | generate                   | Bearer token authorizing `POST /api/revalidate` (ISR cache purge)  |
| `RETAILER_LINKS_API_KEY` | generate                   | Bearer token authorizing `POST /api/retailer-links` (admin writes) |
| `ENCRYPTION_KEY`         | generate                   | Encrypts PII at rest                                               |
| `BLIND_INDEX_KEY`        | generate (different value) | Subscriber blind-index key                                         |

**Notifications (required for alert delivery):**

| Variable                       | Source            | Description                        |
| ------------------------------ | ----------------- | ---------------------------------- |
| `BREVO_API_KEY`                | Brevo console     | Email sending                      |
| `BREVO_SENDER_EMAIL`           | Brevo console     | Verified sender address            |
| `BREVO_SENDER_NAME`            | —                 | Optional; defaults to `ThinkaBell` |
| `ONESIGNAL_APP_ID`             | OneSignal console | REST app ID                        |
| `ONESIGNAL_REST_API_KEY`       | OneSignal console | REST API key                       |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | OneSignal console | Browser app ID (Web Push)          |

**Affiliate (required for revenue links; links fail closed until set):**

| Variable                                | Source               | Description                                                                   |
| --------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `AMAZON_PARTNER_TAG`                    | Amazon Associates    | US partner tag                                                                |
| `AMAZON_PARTNER_TAG_UK` / `_DE` / `_CA` | Amazon Associates    | Optional regional tags                                                        |
| `EBAY_AFFILIATE_CAMPAIGN_ID`            | eBay Partner Network | Campaign ID                                                                   |
| `AFFILIATE_ATTRIBUTION_ID`              | —                    | Optional; defaults to `thinkabell`                                            |
| `AMAZON_LIST_URLS`                      | Your curation        | JSON array of `{ url, marketplace }` entries (`docs/AMAZON_LIST_CURATION.md`) |

**Optional:**

| Variable                                | Source          | Description                                      |
| --------------------------------------- | --------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_POSTHOG_KEY`               | PostHog console | Analytics (consent-gated)                        |
| `NEXT_PUBLIC_POSTHOG_HOST`              | —               | Defaults to `https://app.posthog.com`            |
| `EXCHANGE_RATE_API_URL`                 | —               | Defaults to `https://api.frankfurter.app/latest` |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry console  | Error tracking (consent-gated)                   |

**GitHub Actions secrets** (repo Settings → Secrets and variables → Actions) are separate from the above: only `CRON_SECRET` (same value as above) is used by the CI smoke test. The five `HOSTINGER_*` deploy secrets are **no longer needed** — the SCP deploy workflow was removed; deploys run through Hostinger's native GitHub integration (Step 2). Delete any `HOSTINGER_*` secrets you added earlier.

---

### Step 5: Start & Verify Application

1. In the Hostinger Node.js panel, click **Run** or **Restart Application**.
2. Visit `https://thinkabell.click/api/health` to confirm the server, database connection, and Redis cache are green (`200 OK`).
3. Visit `https://thinkabell.click` to test deal browsing, search, and subscriptions.

---

### Step 6: Populate Products (Discovery)

The database starts empty — products are populated by the discovery job.

1. In the Hostinger Node.js panel (**Environment** section), add:
   - `DISCOVERY_SOURCES` — a JSON array (single line) of sources to run. AppSumo needs **no credentials** (it harvests public pages); PartnerStack and Impact need the credentials from the Step 4 SaaS section. Example (software deals, credential-free):
     ```
     [{"name":"appsumo","type":"software","queries":["productivity","crm","seo","email marketing","ai tools","project management"],"enabled":true}]
     ```
     Each query harvests the top 20 matching deals; the same deal found by several queries is upserted, not duplicated.
2. Click **Restart Application** — Hostinger loads environment variables at app start.
3. Trigger a run (the `CRON_SECRET` from Step 4 authorizes it):
   ```bash
   curl -X POST https://thinkabell.click/api/cron/product-discovery \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```
   Expect `{"discovered":N,"sources":["appsumo"],"errors":[]}`. The endpoint is rate-limited to 10 requests/minute, and concurrent runs are skipped via a job lock — a `discovered: 0` response with sources configured means another run holds the lock, so wait and retry.
4. Verify: `GET /api/deals` lists products; `GET /api/deals?category=software` lists software deals.

**Recurring runs:** the `vercel.json` cron schedules only run on Vercel, so on Hostinger nothing fires them. Schedule the three endpoints from inside Supabase instead — see **Step 6.5: Schedule the cron jobs** below. A Hostinger hPanel cron job works as a fallback, but it lives outside the repository, so a schedule change is a manual hPanel edit rather than a migration.

---

### Step 6.5: Schedule the cron jobs

Hostinger does not run Vercel's `crons` array, so `vercel.json` is inert on this deployment. Schedule the jobs in Supabase instead: `pg_cron` fires on a 6-hour cadence (`0 */6 * * *`, the same schedule) and `pg_net` makes the HTTP call. The app stays stateless, and the schedule is version-controlled — it survives a redeploy.

1. Enable the extensions: Supabase Dashboard → **Database → Extensions** → enable `pg_cron` and `pg_net`.

2. Apply the migration (it creates the jobs and their settings table):

   ```bash
   SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" pnpm db:apply
   ```

   `pnpm db:apply` applies `schema.sql` and then every file in `packages/database/migrations/` that is not yet recorded in `public.schema_migrations`, so it is safe to re-run.

3. Supply the two settings rows. **The migration does not hardcode either value**, and both are read from the database at scheduling time:

   ```sql
   insert into public.cron_settings (key, value) values
     ('site_url', 'https://thinkabell.click'),
     ('cron_secret', '<CRON_SECRET from Step 4>')
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```

   `site_url` is the public origin the cron endpoints run on. `cron_secret` **must equal `CRON_SECRET`** exactly, because the routes authorize the request against that environment variable. Rows are protected by RLS: only the `postgres`/`service_role` roles can read them, and the anon key cannot.

4. Re-run the scheduling function to pick the values up:

   ```sql
   select public.schedule_thinkabell_crons();
   ```

   Expect a `NOTICE` naming the three scheduled jobs. If `cron_settings` is missing a row the function raises a `NOTICE` and schedules nothing, so a misconfigured deployment stays inert rather than calling the endpoints unauthenticated.

Jobs are created **only if the extension is already enabled** — applying the migration before enabling it fails on the `create extension` line, which is the message telling you to do step 1.

**Changing the schedule or secret** is an edit to the settings rows plus a re-run of `schedule_thinkabell_crons()`, which unschedules the existing jobs before recreating them. Nothing else needs to change.

**Verify a job runs** by checking `cron.job_run_details` for a result, or by triggering the endpoint manually:

```bash
curl -X POST https://thinkabell.click/api/cron/product-discovery -H "Authorization: Bearer <CRON_SECRET>"
```

Note that `pg_net` dispatches asynchronously: the job row records the request being _queued_, not its HTTP result. A 401 in the route logs means the `cron_secret` row and the app's `CRON_SECRET` have drifted apart.

---

## Troubleshooting

### "Linked the GitHub repo in hPanel" — two different integrations

Hostinger has two GitHub integrations, and only one builds your app:

- **Node.js web app → Import Git repository → Connect with GitHub** (the Hostinger GitHub App): runs the full pipeline — automatic `pnpm install` → build command → entry file. This is the integration that deploys ThinkaBell. Configure it with the Step 2 settings (application type `Other`, build command `pnpm run build:standalone`, entry file `apps/web/hostinger-server.js`).
- **Websites → Git** (the generic Git deployment): only copies repository files into a directory — no install, no build. A raw checkout has no `node_modules` and no `.next/standalone` output, so the app cannot start. Do not use this integration for ThinkaBell.

If the native integration fails, check in this order:

1. **Build settings** — the deploy log's "Preparing build" section shows the effective settings. The application type must be `Other` with the Step 2 values; Hostinger's auto-detected `Next.js` type starts its own standalone server from the standard single-app layout, which a monorepo does not produce.
2. **Corepack cache** — a `MODULE_NOT_FOUND` for `~/.cache/node/corepack/v1/pnpm/<version>/bin/pnpm.cjs` during install is a corrupted Corepack cache; see the Corepack troubleshooting below.
3. **Runtime logs** — a build that succeeds but a process that crashes on startup is almost always a missing Environment variable (Step 4); check the Runtime Logs in the Node.js dashboard.

### Preflight check

Run the fail-closed preflight checker locally to see exactly what is missing before you deploy:

```bash
pnpm verify:hostinger
```

It reports `[PASS]`/`[WARN]`/`[FAIL]` for the standalone build, the client assets inside it, the entrypoint, the packaged bundle (when present), and the runtime environment variables, and exits non-zero if the deployment would ship a broken app.

### App starts but `/api/health` is unhealthy

The server is up but a fail-closed integration is unconfigured. Set the **Core**, **Security**, **Notifications**, and **Affiliate** variables in Step 4 on the Hostinger Node.js panel (**Environment** section), then **Restart Application**. The most common gaps are `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (database) and `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (cache).

If `/api/health` reports `database: degraded: Could not find the table 'public.products' in the schema cache` (and `/api/deals` or `/api/search` return `500`), the Supabase **connection is fine but the schema was never applied** to the project. Supabase credentials alone do not create tables. Apply the schema once (it is idempotent, safe to re-run):

```bash
# Scripted (recommended) — SUPABASE_DB_URL is the direct Postgres
# connection string from Supabase Dashboard → Project Settings →
# Database → Connection string. Local .env only, never on the app host.
SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" pnpm db:apply
```

Or paste `packages/database/schema.sql` into the Supabase SQL editor and run it. PostgREST reloads its schema cache automatically on DDL, so no further restart is needed.

### App starts but `/api/health` is unhealthy

Start here: `GET /api/health` returns a `checks` object. `database` is the Supabase check and `cache` is Redis.

```
{"status":"unhealthy","checks":{"config":"ok","database":"ok","cache":"error: ..."}}
```

- **`database: error: ... not configured ...`** — the app is not connected to Supabase. See the dedicated section below.
- **`database: degraded: Invalid API key`** — `SUPABASE_URL` reached Supabase but `SUPABASE_ANON_KEY` was rejected. Re-copy both from Dashboard → Project Settings → API. A key copied with a trailing newline or whitespace is the usual cause.
- **`cache: error`** — `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are unset or wrong. Rate limiting and circuit breakers fall back to in-memory state, so the app still works but per-instance limits reset on restart.

### App is not connected to Supabase (environment variables are set)

If Hostinger's **Environment** section clearly holds the Supabase credentials but the app still cannot connect, the variables are almost certainly never reaching `process.env` — and the config layer reports exactly which ones. Add this check first:

1. `GET /api/health` now includes a `config` check that lists the **names** of the variables that failed validation, never their values:

   ```
   "config":"rejected (defaults applied): NEXT_PUBLIC_APP_URL"
   ```

   Empty `checks` plus a valid `database` means the environment arrived intact.

2. The startup log (Hostinger **Runtime Logs**) prints the same list with a reason per variable:
   ```
   ⚠️ [Config] 1 environment variable(s) rejected (1 invalid, 0 unset). Defaults applied; missing credentials are inert.
      - NEXT_PUBLIC_APP_URL (invalid value): value: Invalid url
   ```

The common causes, in order of likelihood:

| Symptom in the log / health check         | Cause                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL (invalid value)`     | The URL is missing its scheme. `https://thinkabell.click` is required; `thinkabell.click` is not a valid URL.    |
| `PORT (invalid value)`                    | A non-numeric value. Leave `PORT` unset so Hostinger assigns it.                                                 |
| `SUPABASE_URL (invalid value)`            | Not a URL, or the dashboard URL was pasted into the key field (or vice versa). It must start with `https://`.    |
| `BREVO_SENDER_EMAIL (invalid value)`      | A sender address without a domain, e.g. `noreply@localhost`. Contact-form sends fail until it is a real address. |
| No `config` check at all, `database` fine | Nothing is wrong — the rest of the health output is a different problem.                                         |

Why this used to be invisible: the config layer validated the whole environment in one pass and, on **any** failure, discarded every value and fell back to defaults — so one malformed variable silently disabled the Supabase credentials alongside it, with only a `console.warn` on a host that discards stdout. Validation is now per-variable: a rejected variable falls back to _its own_ default, the credentials the host delivered keep working, and the offending name is reported in the logs and in `/api/health`.

Two more environment-specific gotchas:

- **The value is set on the build step, not the runtime.** Hostinger's **Environment** section applies to the running app; a build-time-only value is baked into the build (and `NEXT_PUBLIC_*` values are inlined at build time). Set them under Environment and click **Restart Application** — Hostinger reloads them at process start, so a change without a restart does nothing.
- **The variable is defined in `.env` instead of the Environment section.** Files are only a fallback: `packages/config` reads `.env` through dotenv, which never overrides a value the host already delivered, so a local `.env` cannot supply a variable that Hostinger also sets — and because `.env*` is gitignored it is not in the deployed bundle at all. Use the Environment section.

If the environment is correct but `database` still fails, verify from a shell on the host:

```bash
curl -s https://thinkabell.click/api/health | head -c 400
```

### Hostinger shows the Supabase connection configured, but Supabase shows no requests

This is a placeholder credential, not a broken integration. `.env.example`
used to ship `SUPABASE_URL=https://your-project.supabase.co` and
`SUPABASE_ANON_KEY=your-supabase-anon-key`; either value is non-empty, so the
fail-closed guard passed it, and the URL is _syntactically valid_, so nothing
else rejected it. The client was constructed and pointed at a host that does
not exist — Hostinger sees a configured value, Supabase receives nothing.

Supabase credentials are now validated for shape (a real project ref for the
URL, a JWT or `sb_publishable_`/`sb_secret_` key for the key), so a rejected
value is dropped and reported by variable name rather than used. Check:

```bash
curl -s https://thinkabell.click/api/health
```

A non-empty `config` check — `rejected (defaults applied): SUPABASE_URL,
SUPABASE_ANON_KEY, …` — means the host delivered values that failed
validation. Set the five variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and the two `NEXT_PUBLIC_` equivalents) to real
values from Supabase → Project Settings → API, then restart. The
`NEXT_PUBLIC_` pair must be present at **build** time too, since Next.js
inlines them into the browser bundle.

The same applies to `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` (a malformed DSN
logs `Invalid Sentry Dsn` on every boot), `UPSTASH_REDIS_REST_URL` (a
placeholder like `https://your-redis.upstash.io` is a valid URL pointing at
nothing), and `NEXT_PUBLIC_POSTHOG_KEY`. `.env.example` ships empty values
with instructions for all of them.

#### Verify the connection from the host

`/api/health` answers the question from inside the app. For a stage-by-stage
answer, including which of the four possible causes it is, run:

```bash
pnpm run check:supabase            # or: pnpm tsx scripts/check-supabase-connection.ts
pnpm run check:supabase -- --json  # machine-readable, for monitoring
```

The script reports each stage separately, because they need different fixes and
collapsing them into one error is what makes the symptom hard to diagnose:

| Stage  | Meaning when it fails                                                                      |
| ------ | ------------------------------------------------------------------------------------------ |
| config | A variable is unset or malformed in this environment (the placeholder case).               |
| node   | The runtime Node is older than the `node: >=22.0.0` that `@supabase/supabase-js` requires. |
| reach  | The project host is unreachable — DNS, TLS, egress, or a URL that does not resolve.        |
| auth   | The host answered but rejected the key (401/403).                                          |
| data   | The request **reached** Supabase; the failure is RLS or schema, not the connection.        |

Exit code is 0 only when a real query through the app's own client succeeds, so
it can gate a deploy. No secret is ever printed — only the last four characters
of a key, so you can confirm which value is loaded.

`--table` probes a specific table (default `products`): pass a table you know
exists to separate an RLS problem from a missing table.

On the `node` stage: `@supabase/supabase-js` declares `engines.node >=22.0.0`,
so Node 20 is a genuine version shortfall rather than a cosmetic warning. The
host currently runs Node 20 while the repo pins `>=22` and CI uses 22 — correct
the hPanel Node version, not the code.

> **Do not add a standalone `db.js`.** A root- or app-level script that calls
> `createClient()` with `process.env.SUPABASE_API_KEY` duplicates
> `packages/database/src/client.ts` with two defects: `SUPABASE_API_KEY` is not a
> variable this repo reads (it uses `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`),
> so it would connect as `undefined`, and the table name is a placeholder. Such a
> file is never imported, so it silently does nothing while looking like the
> connection path.

`packages/database` logs the project ref on first client construction — e.g.
`[Database] Supabase anon client connected to project "abcdefghij…" (key …1234)`
— so the runtime log names the project it connected to. Key presence only is
logged, never the key.

### `node_modules` disappears or is rebuilt mid-build

`verifyDepsBeforeRun` defaults to `install`, which makes `pnpm run` / `pnpm exec`
remove and rebuild `node_modules` whenever they consider the tree stale — which
a pnpm whose version differs from the one that installed always does. On a host
with an empty store or restricted network that fails the build, and it can
destroy the tree outright.

`pnpm-workspace.yaml` sets `verifyDepsBeforeRun: warn`, so runs are read-only
with respect to `node_modules` and installs happen only when asked for.

### Build fails with `next: command not found`

`sh: line 1: next: command not found` — usually with `WARN Local package.json exists, but node_modules missing` — means the dependency install ran with **npm** instead of pnpm. npm does not read `pnpm-workspace.yaml`, so a root `npm install` installs only the root devDependencies and leaves every workspace package without its dependencies.

Fix the hPanel → Node.js → Build settings (**Package manager: `pnpm`**, **Build command: `pnpm run build:standalone`**) and redeploy.

`scripts/verify-build-env.js` runs before the build and reports what it finds. Two conditions are fatal, because the workspace root is genuinely unresolvable without them: the wrong package manager (npm does not read `pnpm-workspace.yaml`) and an incomplete install. A **pnpm version mismatch is advisory** — it is logged and the build proceeds, because `pmOnFail: warn` in `pnpm-workspace.yaml` makes that the deliberate policy. A hard failure there would re-block the build the policy exists to unblock.

### Build fails on `pnpm install` (Corepack `MODULE_NOT_FOUND`)

If you build **on Hostinger** (native GitHub integration) and it fails during `pnpm install` with a `MODULE_NOT_FOUND` for a path like `~/.cache/node/corepack/v1/pnpm/<version>/bin/pnpm.cjs`, that is a **corrupted Corepack cache** on the build environment — not an invalid pnpm version.

Hostinger runs `pnpm install` **automatically, before your build command** — so a build command that clears the cache cannot fix it (the failure happens first). The fix is in the repository: the `packageManager` field is pinned to **`pnpm@10.34.6`** (the latest pnpm 10.x, matching the lockfile's `lockfileVersion: '9.0'` format, which the pnpm 10 line writes natively). Corepack downloads that version fresh on the build environment — there is no cached entry for it to be corrupted — so the automatic install succeeds.

If you ever hit this again with a different version, clear the Corepack cache once via SSH (hPanel → Advanced → SSH Access; Premium Web or higher): `rm -rf ~/.cache/node/corepack` — the next automatic install re-downloads the pinned version fresh.

### Build fails on a pnpm version mismatch

pnpm aborting with a bad-version error (`ERR_PNPM_BAD_PM_VERSION`, or a message that the running version differs from the declared one) means a build step resolved a **different pnpm than the one that installed** — typically a pnpm 11 host shelling out through the Corepack shim while install used the pinned version. The authoritative version is the `packageManager` field of the root `package.json` (currently `pnpm@10.34.6`).

Two mechanisms in this repository prevent it:

1. `pnpm-workspace.yaml` sets `pmOnFail: download` (added in pnpm 11), so any pnpm 11+ host downloads and runs the pinned version instead of aborting. Leave it at the default `download`; if you manage pnpm externally (asdf/mise/Volta), set `pmOnFail: ignore`.
2. `scripts/build-standalone.js` invokes the Next.js CLI directly (`node_modules/next/dist/bin/next build`) instead of `pnpm --filter @thinkabell/web run build`, so the build does not trigger a second package-manager resolution that can pull a different version.

As a safety net, the root `build` and `build:standalone` scripts run `scripts/verify-build-env.js` first: it reads the pin from `package.json` and exits non-zero with the exact hPanel settings when the active pnpm version does not match, instead of failing mid-build.

A mismatch that is merely _warned about_ is still dangerous: pnpm 10 and pnpm 11 lay out `node_modules` differently, so installing with one and building with the other leaves a broken mixed layout. Do not silence it with `pmOnFail: warn`.

### Approving dependency build scripts

Dependency lifecycle (postinstall) scripts are approved in `pnpm-workspace.yaml` under `allowBuilds` (`@sentry/cli`, `core-js`, `esbuild`, `protobufjs`, `sharp`, `unrs-resolver`, `workerd`) — a package not listed there cannot run its build scripts. pnpm 11 removed `onlyBuiltDependencies`, so the `pnpm` field of `package.json` and `.npmrc`'s `only-built-dependencies` are both ignored there (the former is also warned about) and no longer declare approvals. Keep `allowBuilds` the single source of truth; when a dependency reports an ignored build script, add it there.

### GitHub Pages vs Hostinger

GitHub Pages (`https://<user>.github.io/ThinkaBell/`) only serves static files. ThinkaBell needs a Node.js runtime (API routes, middleware, server components, ISR), so GitHub Pages cannot run the full app — it is a static preview at best. Hostinger Node.js hosting is the production target.
