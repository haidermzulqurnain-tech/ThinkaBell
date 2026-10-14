# Hostinger Node.js Deployment Guide

How to deploy **ThinkaBell** to Hostinger Node.js hosting, in the order the steps have to happen.

The current deployment is: **Hostinger native GitHub integration**, application type `Other`, entry point `apps/web/hostinger-server.js`, and **all secrets served from the Hostinger Environment section**. Vercel's `vercel.json` is inert here — the cron schedule comes from Supabase `pg_cron` instead.

This guide is the **order**. For what each credential is, where it comes from, and the signup/dashboard link for every external service, see **[DEPLOYMENT_REQUIREMENTS.md](./DEPLOYMENT_REQUIREMENTS.md)**.

> **Order matters in two places**, and both are the reason this guide is sequenced the way it is:
>
> 1. **Environment variables must be set before the first build.** Every `NEXT_PUBLIC_*` value is inlined into the browser bundle at _build_ time. Setting them after the build ships a bundle with an empty value baked in.
> 2. **A runtime-only variable needs a restart.** Hostinger reads the Environment section at process start, so adding `SUPABASE_*` without restarting leaves the running process with the old values.

---

## Deployment sequence

| Step | What                                          | Blocks the next step?                      |
| ---- | --------------------------------------------- | ------------------------------------------ |
| 1    | Connect the repository (GitHub App)           | Yes — nothing can build without it         |
| 2    | Configure hPanel build settings               | Yes                                        |
| 3    | **Set environment variables**                 | Yes — `NEXT_PUBLIC_*` are inlined at build |
| 4    | First deploy                                  | Yes                                        |
| 5    | Verify the app and the Supabase connection    | Yes                                        |
| 6    | Apply the database schema and migrations      | Yes                                        |
| 7    | Schedule the cron jobs                        | No — but prices never refresh without it   |
| 8    | Populate products (discovery)                 | No                                         |
| —    | Troubleshooting / local build / manual upload | Fallbacks                                  |

---

## Step 1: Connect the repository

Hostinger has two GitHub integrations and **only one builds**:

- **Node.js web app → Import Git repository → Connect with GitHub** (the Hostinger GitHub App) — runs the full pipeline: automatic `pnpm install` → build command → entry file. **This is the one to use.**
- **Websites → Git** (generic Git deployment) — only copies repository files into a directory. No install, no build, so the app cannot start. Do not use it for ThinkaBell.

Point it at the `main` branch. Every push to `main` then runs install → build → restart.

---

## Step 2: Configure the hPanel build settings

Hostinger auto-detects the framework as **Next.js** — **override it to `Other`**.
Hostinger's Next.js mode expects the standard single-app standalone layout
(`.next/standalone/server.js`). This is a pnpm monorepo, so it emits the server
at `apps/web/.next/standalone/apps/web/server.js`, which that mode cannot find.
The `Other` type runs the repository's own entrypoint instead.

| Setting              | Value                          | Why                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Application type** | `Other`                        | Runs our entrypoint instead of Hostinger's Next.js-mode server start, which expects a non-monorepo layout.                                                                                                                                                                                                                 |
| **Node version**     | `22.x`                         | **Required, not preferred.** `@supabase/supabase-js` declares `engines.node >=22.0.0`. Node 20 still runs but is a version shortfall and is what produced the deprecation warning in the runtime log. It also matches `engines.node` and the CI runners.                                                                   |
| **Root directory**   | `./`                           | Must stay the repository root: the automatic `pnpm install` needs the workspace root (`pnpm-workspace.yaml`) to resolve the `workspace:*` dependencies. Hostinger's monorepo auto-detection would pick `apps/web` and build only that subdirectory, which breaks the workspace install.                                    |
| **Build command**    | `pnpm run build:standalone`    | Runs the preflight, then the Next.js build with `OUTPUT=standalone` injected cross-platform, and copies `.next/static` + `public/` into the standalone output. A plain `pnpm run build` (turbo) does **not** emit `.next/standalone`.                                                                                      |
| **Package manager**  | `pnpm`                         | **Set this explicitly — it is not auto-detected.** If it stays on the `npm` default, the automatic install runs `npm install`, which does not read `pnpm-workspace.yaml`: only root devDependencies install and every workspace package is left without `node_modules`, so the build fails with `next: command not found`. |
| **Output directory** | _(leave empty)_                | Ignored for `Other` when an entry file is set.                                                                                                                                                                                                                                                                             |
| **Entry file**       | `apps/web/hostinger-server.js` | Relative to the root directory.                                                                                                                                                                                                                                                                                            |
| **Port**             | _(leave unset)_                | `hostinger-server.js` binds whatever `PORT` the host assigns; the app itself reads it too.                                                                                                                                                                                                                                 |

**On the pnpm version.** The pin is the `packageManager` field in the root
`package.json` (currently `pnpm@10.34.6`). `pnpm-workspace.yaml` sets
`pmOnFail: warn` and `verifyDepsBeforeRun: warn`, so a host whose pnpm shim
resolves to a newer version (e.g. 11.x) **logs the mismatch and continues**.
Both the automatic install and the build then run under the same pnpm, which
keeps `node_modules` in one layout instead of the mixed 10/11 layout that was
breaking the workspace. Do not add `pmOnFail: download` back: it makes pnpm try
to download the pinned version, and on this host that attempt is what aborts
the build.

---

## Step 3: Set the environment variables — **before the first build**

In hPanel → Node.js → **Environment**, add the variables below. Two rules:

- **Set them all before the first deploy**, because `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time. A variable added after the build ships an empty value in the bundle.
- **Restart after any change.** Runtime-only variables are read at process start.

Every value below comes from the Hostinger Environment section — that is the
single place this deployment takes its configuration from. Nothing is read from
a file, and there is no `.env` in the deployed bundle.

### Core (required for a healthy `/api/health`)

| Variable                        | Source                            | Notes                                                                                                                                                              |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                      | —                                 | `production`. Set it explicitly: `hostinger-server.js` normalises anything non-standard to `production`, but a standard value avoids the Next.js warning entirely. |
| `NEXT_PUBLIC_APP_URL`           | —                                 | `https://thinkabell.click`. Must be a full URL with scheme — a bare hostname fails validation.                                                                     |
| `SUPABASE_URL`                  | Supabase → Project Settings → API | Project URL. Must be a real `https://<ref>.supabase.co` project host.                                                                                              |
| `SUPABASE_ANON_KEY`             | Supabase → API                    | A JWT or an `sb_publishable_…` key.                                                                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → API                    | A JWT or `sb_secret_…` key. Server-side only.                                                                                                                      |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → API                    | Same value as `SUPABASE_URL`. **Inlined at build time.**                                                                                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API                    | Same value as `SUPABASE_ANON_KEY`. **Inlined at build time.**                                                                                                      |
| `UPSTASH_REDIS_REST_URL`        | Upstash console                   | Must be a real `https://<name>.upstash.io` host.                                                                                                                   |
| `UPSTASH_REDIS_REST_TOKEN`      | Upstash console                   |                                                                                                                                                                    |

### Security (required — these endpoints fail closed without them)

| Variable                 | Source   | Notes                                                                                     |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| `CRON_SECRET`            | generate | Bearer token for `/api/cron/*`. The same value goes into the `cron_secret` row in Step 7. |
| `ALERTS_API_KEY`         | generate | Bearer token for `/api/alerts`.                                                           |
| `REVALIDATION_SECRET`    | generate | Bearer token for `POST /api/revalidate`.                                                  |
| `RETAILER_LINKS_API_KEY` | generate | Bearer token for `POST /api/retailer-links`.                                              |
| `ENCRYPTION_KEY`         | generate | `openssl rand -hex 32`. Until set, PII is stored in plaintext.                            |
| `BLIND_INDEX_KEY`        | generate | A **different** `openssl rand -hex 32` value.                                             |

### Notifications

| Variable                       | Source            | Notes                                              |
| ------------------------------ | ----------------- | -------------------------------------------------- |
| `BREVO_API_KEY`                | Brevo console     | Email sending.                                     |
| `BREVO_SENDER_EMAIL`           | Brevo console     | A verified sender address — must be a valid email. |
| `BREVO_SENDER_NAME`            | —                 | Optional; defaults to `ThinkaBell`.                |
| `CONTACT_EMAIL`                | —                 | Optional contact address.                          |
| `ONESIGNAL_APP_ID`             | OneSignal console | REST app ID.                                       |
| `ONESIGNAL_REST_API_KEY`       | OneSignal console | REST API key.                                      |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | OneSignal console | Browser app ID. **Inlined at build time.**         |

### Affiliate links

| Variable                                | Source               | Notes                                                                      |
| --------------------------------------- | -------------------- | -------------------------------------------------------------------------- |
| `AMAZON_PARTNER_TAG`                    | Amazon Associates    | US tag. Links fail closed until set.                                       |
| `AMAZON_PARTNER_TAG_UK` / `_DE` / `_CA` | Amazon Associates    | Optional regional tags.                                                    |
| `AMAZON_LIST_URLS`                      | Your curation        | JSON array of `{ url, marketplace }` — see `docs/AMAZON_LIST_CURATION.md`. |
| `AMAZON_LIST_MARKETPLACE`               | —                    | Optional; defaults to `US`.                                                |
| `AMAZON_LIST_MAX_ITEMS`                 | —                    | Optional; defaults to `100`.                                               |
| `AMAZON_LIST_FETCH_DELAY_MS`            | —                    | Optional; defaults to `1000`.                                              |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | eBay Developer       | For the Browse API source.                                                 |
| `EBAY_AFFILIATE_CAMPAIGN_ID`            | eBay Partner Network | For affiliate attribution.                                                 |
| `WALMART_API_KEY`                       | Walmart console      | Optional source credentials.                                               |

### Discovery (Step 8)

| Variable            | Source        | Notes                                                                                                                                                                                                                                                 |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCOVERY_SOURCES` | Your curation | A single-line JSON array of `{ name, type, queries, enabled }`. **Read directly from `process.env` by the jobs package, so it is not validated by the env schema** — a malformed value is logged by the runner rather than reported by `/api/health`. |

### Variables that bypass the env schema

Three variables are read directly from `process.env` by the package that uses
them, so they are **not** shape-validated and will **not** appear in the `config`
line of `/api/health`:

| Variable            | Read by           | Effect when missing or malformed                                                                |
| ------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `DISCOVERY_SOURCES` | `apps/jobs`       | Logged by the runner; treated as "no sources configured" (zero products).                       |
| `ENCRYPTION_KEY`    | `packages/shared` | PII stored in plaintext. Must be 64-char hex.                                                   |
| `BLIND_INDEX_KEY`   | `packages/shared` | Blind index falls back to `lower(email)`, which is not a security control. Must be 64-char hex. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and their
`NEXT_PUBLIC_` equivalents **are** validated, which is why a placeholder there is
caught and these three are not.

### Optional

| Variable                                   | Source          | Notes                                                                                   |
| ------------------------------------------ | --------------- | --------------------------------------------------------------------------------------- |
| `PARTNERSTACK_API_KEY`                     | PartnerStack    | SaaS affiliate source.                                                                  |
| `IMPACT_ACCOUNT_SID` / `IMPACT_AUTH_TOKEN` | Impact          | SaaS affiliate source.                                                                  |
| `AFFILIATE_ATTRIBUTION_ID`                 | —               | Optional; defaults to `thinkabell`.                                                     |
| `EDGE_PROXY_TRUSTED`                       | —               | `true` only when behind the Cloudflare edge-worker proxy. Never used for authorization. |
| `EXCHANGE_RATE_API_URL`                    | —               | Defaults to `https://api.frankfurter.app/latest`.                                       |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST`        | PostHog console | Analytics, consent-gated. **Inlined at build time.**                                    |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`    | Sentry console  | Error tracking. Both empty = Sentry never initialises.                                  |
| `SENTRY_TRACES_SAMPLE_RATE`                | —               | Optional; defaults to `0.1`.                                                            |

### Never paste a placeholder

The values in `.env.example` are shipped **empty**, and that is deliberate. A
placeholder such as `https://your-project.supabase.co` is non-empty, so it
passes a presence check, and it is a _syntactically valid_ URL, so nothing else
rejects it — the client is built and pointed at a host that does not exist.
Hostinger then shows the connection as configured while Supabase receives no
requests, which is the exact symptom this prevents.

Supabase URLs and keys are validated for **shape** (a real project ref; a JWT or
an `sb_` key), so a malformed value is dropped and reported **by variable name**
in `/api/health` and the startup log instead of being used.

**GitHub Actions secrets** (repo Settings → Secrets and variables → Actions) are
separate from all of the above: only `CRON_SECRET` (same value) is used by the CI
smoke test. The `HOSTINGER_*` deploy secrets are no longer needed — deploys run
through the native integration.

---

## Step 4: Deploy

```bash
git push origin main
```

Hostinger runs: `pnpm install` → `pnpm run build:standalone` →
`node apps/web/hostinger-server.js`.

To redeploy without a new commit, use **Restart Application** in hPanel.

---

## Step 5: Verify

**1. Health endpoint** — `GET https://thinkabell.click/api/health`

```json
{ "status": "healthy", "checks": { "config": "ok", "database": "ok", "cache": "ok" } }
```

| `checks` value                             | Meaning                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `config: "ok"`                             | Every environment variable the host delivered passed validation.                        |
| `config: "rejected (defaults applied): …"` | Names the variables that failed — that integration is inert. Values are never returned. |
| `database: "error: …not configured…"`      | `SUPABASE_URL`/`SUPABASE_ANON_KEY` are missing.                                         |
| `database: "degraded: Invalid API key"`    | The URL reached Supabase but the key was rejected — re-copy both.                       |
| `cache: "error"`                           | Upstash is unset; rate limiting falls back to in-memory.                                |

**2. Supabase connection, stage by stage** — run on the host:

```bash
pnpm run check:supabase
```

Reports `config`, `node`, `reach`, `auth`, and `data` separately, exit code 0 only
when a real query through the app's own client succeeds. See the troubleshooting
table below for what a failing stage means.

**3. The site** — browse `/`, `/deals`, `/search`, and confirm the runtime log
shows the client connected to a real project:

```
[Database] Supabase anon client connected to project "abcdefghij…" (key …1234)
```

**4. Current runtime path.** The deployed build may run either layout, and the
startup log says which:

- `Loading server bundle from: …` — the **standalone** server (smaller, only production deps).
- `Using \`next start\` (no standalone output; full-project deploy).` — the **full-project** path, when no standalone output was produced. Fully supported; it just ships the whole project rather than a traced bundle.

**5. Preflight.** The fail-closed preflight runs as the first thing in the build
command (`scripts/verify-build-env.js`), so a wrong package manager or an
incomplete install fails the build immediately with the exact settings rather
than deep inside the pipeline. To see the same check standalone:

```bash
pnpm verify:hostinger
```

It reports `[PASS]`/`[WARN]`/`[FAIL]` for the standalone build, the client assets
inside it, the entrypoint, the packaged bundle, and the runtime environment
variables, and exits non-zero if the deployment would ship a broken app. A pnpm
_version_ mismatch is a `[WARN]`, not a `[FAIL]` — see the pnpm entries in
troubleshooting.

**Reading its output against the current deployment.** The two standalone checks
(`Standalone server missing`, `Standalone client assets missing`) validate the
standalone layout specifically. They `[FAIL]` when no standalone output was
produced — which is the case on the current deployment, where the runtime log
shows `Using \`next start\` (no standalone output; full-project deploy)`and the
app runs correctly. So those two failures are expected and harmless **only** when
you are deliberately using the full-project path. If you intend the standalone
path, run`pnpm run build:standalone` and re-check.

The `[WARN]` lines are not failures: the deploy bundle is only needed for a manual
upload, and the runtime environment variables are set on the host (Step 3), not
locally.

---

## Step 6: Apply the database schema and migrations

The app connects over Supabase's REST API, but the schema itself is DDL, which
that API cannot run. Apply it over the direct Postgres connection:

```bash
SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" pnpm db:apply
```

`pnpm db:apply` applies `packages/database/schema.sql`, then every file in
`packages/database/migrations/` that is not yet recorded in
`public.schema_migrations` — so it is idempotent and safe to re-run. This is
what keeps the cron schedule (Step 7) under version control.

`SUPABASE_DB_URL` is a **separate admin credential** from `SUPABASE_URL`. Set it
in your local `.env` for this command only — the running app never needs it.

Then confirm: tables `products`, `price_history`, `subscribers`, `alert_queue`,
`retailer_links`, `click_tracking`, `alert_dead_letter`, `job_runs` exist, and
RLS is active on all of them.

---

## Step 7: Schedule the cron jobs

Hostinger does not run Vercel's `crons` array, so `vercel.json` is inert here.
Schedule the jobs in Supabase instead: `pg_cron` fires on a 6-hour cadence
(`0 */6 * * *`) and `pg_net` makes the HTTP call. The app stays stateless and
the schedule is version-controlled.

1. Enable `pg_cron` and `pg_net` (Supabase → Database → Extensions). **Do this first** — the migration fails on the `create extension` line otherwise.
2. `pnpm db:apply` (already done in Step 6; it records the migration).
3. Insert the two settings rows. Neither is hardcoded — the migration reads them at scheduling time:

   ```sql
   insert into public.cron_settings (key, value) values
     ('site_url', 'https://thinkabell.click'),
     ('cron_secret', '<CRON_SECRET from Step 3>')
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```

   `cron_secret` **must equal `CRON_SECRET` exactly** — the routes authorize the
   request against that environment variable. Rows are `TO service_role` only,
   so the anon key cannot read the secret.

4. Run the scheduler:

   ```sql
   select public.schedule_thinkabell_crons();
   ```

   Expect a `NOTICE` naming the three jobs. If a settings row is missing, it
   raises a `NOTICE` and schedules **nothing** — a half-configured deployment
   stays inert rather than calling the endpoints unauthenticated.

The three jobs are `thinkabell-product-discovery`, `thinkabell-fetch-prices`, and
`thinkabell-send-alerts`. **Changing the schedule or secret** is an edit to the
settings rows plus a re-run of the function, which unschedules before recreating.

`pg_net` dispatches asynchronously, so a job row records a request being
_queued_, not its HTTP result. Verify with `cron.job_run_details`, or trigger
the endpoint directly:

```bash
curl -X POST https://thinkabell.click/api/cron/fetch-prices \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

## Step 8: Populate products (discovery)

The database starts empty. Set `DISCOVERY_SOURCES` in the Environment section,
restart, then trigger a run:

```bash
curl -X POST https://thinkabell.click/api/cron/product-discovery \
  -H "Authorization: Bearer <CRON_SECRET>"
```

`appsumo` needs no credentials (it harvests public pages). For the `amazon-list`
source, see `docs/AMAZON_LIST_CURATION.md` — no Amazon login is used or stored.
Expect `{"discovered":N,"sources":[…],"errors":[]}`; a `discovered: 0` with sources
configured means another run holds the job lock, so retry after it completes.

---

## Fallbacks

### Local build → manual upload

Only needed if the native GitHub integration is unavailable:

```bash
pnpm install
pnpm package:hostinger     # → dist/hostinger-deploy/
```

Then zip the **contents** of `dist/hostinger-deploy/` and upload via Hostinger
File Manager. Uploading the raw repository instead does not work: it has no
`node_modules` and no build output.

**Windows note:** standalone output requires symlink support — enable Developer
Mode or run elevated. Otherwise use the full-project path (`next start`), which
needs no symlinks.

### Local verification

```bash
pnpm run type-check
pnpm run lint
pnpm run test
pnpm run format:check
pnpm tsx scripts/compliance-check.ts
pnpm run check:supabase
```

---

## Troubleshooting

### "Hostinger shows the Supabase connection configured, but Supabase shows nothing"

A placeholder credential. See Step 3 — check the `config` line of `/api/health`
first; it names the offending variables. Run `pnpm run check:supabase` on the
host for the stage-by-stage answer.

The cause is named in `/api/health`'s `config` line and in the Runtime Logs,
which print the same list with a reason per variable:

```
⚠️ [Config] 2 environment variable(s) rejected (2 invalid, 0 unset)...
   - SUPABASE_URL (invalid value): value: not a Supabase project URL
   - SUPABASE_ANON_KEY (invalid value): value: not a Supabase key
```

Values are never printed, only names and reasons. The common causes, in order of
likelihood:

| Symptom in the log / health check     | Cause                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `SUPABASE_URL (invalid value)`        | Not a URL, or a placeholder. Must be `https://<ref>.supabase.co` with a real project ref.        |
| `SUPABASE_ANON_KEY (invalid value)`   | A placeholder, or a key copied with surrounding whitespace. Must be a JWT or `sb_publishable_…`. |
| `NEXT_PUBLIC_APP_URL (invalid value)` | Missing its scheme — `https://thinkabell.click`, not `thinkabell.click`.                         |
| `PORT (invalid value)`                | Non-numeric. Leave it unset so Hostinger assigns it.                                             |
| `BREVO_SENDER_EMAIL (invalid value)`  | A sender without a domain, e.g. `noreply@localhost`.                                             |
| `config: "ok"`, `database: "ok"`      | The environment arrived intact — the problem is elsewhere.                                       |

This used to be invisible: the config layer validated the whole environment in
one pass and, on **any** failure, discarded every value and fell back to
defaults — so one malformed variable silently disabled the Supabase credentials
alongside it, signalled only by a `console.warn` on a host that discards stdout.
Validation is now per-variable: a rejected variable falls back to _its own_
default, the values the host did deliver keep working, and the offending name is
reported in both the logs and `/api/health`.

Two more environment-specific gotchas:

- **The value is set at build time, not runtime.** `NEXT_PUBLIC_*` values are inlined into the browser bundle, so a variable present only at runtime ships an empty value in the bundle. Set them in Environment (Step 3) and redeploy.
- **The variable changed but the app was not restarted.** Hostinger reads the Environment section at process start; a change without a restart does nothing.

### App starts but `/api/health` is unhealthy

The server is up but a fail-closed integration is unconfigured. Set the Core,
Security, Notifications, and Affiliate variables (Step 3), then **Restart
Application**. The most common gaps are the Supabase set and the Upstash set.

If `/api/health` reports
`database: degraded: Could not find the table 'public.products' in the schema cache`
(and `/api/deals` or `/api/search` return `500`), the connection is **fine but the
schema was never applied** — credentials alone do not create tables. Apply it
once with `pnpm db:apply` (Step 6); it is idempotent, so re-running is safe.

### Approving dependency build scripts

Dependency lifecycle (postinstall) scripts are approved in `pnpm-workspace.yaml`
under `allowBuilds` (`@sentry/cli`, `core-js`, `esbuild`, `protobufjs`, `sharp`,
`unrs-resolver`, `workerd`) — a package not listed there cannot run its build
scripts. `strictDepBuilds` defaults to `true`, so an install that reaches an
unreviewed build fails with `ERR_PNPM_IGNORED_BUILDS`; pnpm also auto-lists
ignored builds into `pnpm-workspace.yaml` with a placeholder value so you can
set them explicitly.

pnpm 11 removed `onlyBuiltDependencies`, so the `pnpm` field of `package.json`
and `.npmrc`'s `only-built-dependencies` are both ignored there (the former also
warns) and no longer declare approvals. Keep `allowBuilds` the single source of
truth; when a dependency reports an ignored build script, add it there.

### What each `check:supabase` stage means

| Stage    | A failure means                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------- |
| `config` | A variable is unset or malformed in this environment.                                               |
| `node`   | The runtime Node is older than the `>=22.0.0` that `@supabase/supabase-js` requires. Fix in hPanel. |
| `reach`  | The project host is unreachable — DNS, TLS, egress, or a URL that does not resolve.                 |
| `auth`   | The host answered but rejected the key (401/403). Re-copy both values.                              |
| `data`   | The request **reached** Supabase; the problem is RLS or schema, not the connection.                 |

Exit code is 0 only when a real query through the app's own client succeeds, so
it can gate a deploy. `--table <name>` probes a specific table (default
`products`), and `--json` gives machine-readable output.

### Build fails with `next: command not found`

The install ran with **npm** instead of pnpm. npm does not read
`pnpm-workspace.yaml`, so workspace packages get no dependencies. Fix the
Package manager setting (Step 2) and redeploy. `scripts/verify-build-env.js`
fails fast with the exact settings when the package manager is wrong or the
install is incomplete; a pnpm _version_ mismatch is advisory and only logged.

### Build aborts on a pnpm version check

`pmOnFail: download` tries to download the pinned version and aborts when it
cannot. It is set to `warn` (Step 2) so the host's pnpm is used and logged
instead. Same for `verifyDepsBeforeRun: warn` — its default, `install`, would
make `pnpm run` try to rebuild `node_modules` on any mismatch, which can destroy
a working tree on a host with an empty store.

### `node_modules` disappears or is rebuilt mid-build

Same cause — `verifyDepsBeforeRun` defaulting to `install`. Already set to
`warn`.

### `Invalid Sentry Dsn` on every boot

A placeholder `SENTRY_DSN`. Empty means Sentry never initialises, which is the
correct unconfigured state.

### Build fails during `pnpm install` (`MODULE_NOT_FOUND` for a Corepack path)

A corrupted Corepack cache on the build environment — not an invalid version.
Hostinger installs **before** your build command, so a build command that clears
the cache cannot fix it; retry the deploy.
