# Hostinger Node.js Deployment Guide

This guide details how to deploy the **ThinkaBell** Next.js 14+ application to Hostinger Node.js hosting.

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

| Setting | Value | Why |
|---|---|---|
| **Application type** | `Other` | Runs our entrypoint instead of Hostinger's Next.js-mode server start, which expects the standard (non-monorepo) standalone layout. |
| **Node version** | `22.x` | Matches the `engines.node` field in `package.json` and the CI runners. |
| **Root directory** | `./` | Must stay the repository root: the automatic `pnpm install` needs the workspace root (`pnpm-workspace.yaml`) to resolve the `workspace:*` dependencies. Hostinger's monorepo auto-detection would pick `apps/web` and build only that subdirectory, which breaks the workspace install. |
| **Build command** | `pnpm run build:standalone` | Injects `OUTPUT=standalone` cross-platform and copies `.next/static` + `public/` into the standalone output. A plain `pnpm run build` (turbo) does **not** emit `.next/standalone`. |
| **Package manager** | `pnpm` | Auto-detected from `pnpm-lock.yaml`. |
| **Output directory** | *(leave empty)* | Ignored for `Other` when an entry file is set. |
| **Entry file** | `apps/web/hostinger-server.js` | Relative to the root directory. Resolves the standalone server at `apps/web/.next/standalone/apps/web/server.js`, binds the `PORT` Hostinger assigns, and falls back to `next start` when no standalone build exists. |

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

| Variable | Source | Description |
|---|---|---|
| `NODE_ENV` | — | `production` |
| `PORT` | — | Leave unset; Hostinger assigns the port dynamically |
| `NEXT_PUBLIC_APP_URL` | — | `https://thinkabell.click` — drives unsubscribe links and `utm_source` |
| `SUPABASE_URL` | Supabase console (Project Settings → API) | Project URL |
| `SUPABASE_ANON_KEY` | Supabase console | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase console | Secret key — server-side only, never browser-exposed |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase console | Same as `SUPABASE_URL` (browser-facing) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase console | Same as `SUPABASE_ANON_KEY` (browser-facing) |
| `UPSTASH_REDIS_REST_URL` | Upstash console | Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console | Redis REST token |

**Security (required — endpoints fail closed without them):**

| Variable | Source | Description |
|---|---|---|
| `CRON_SECRET` | generate | Bearer token authorizing `/api/cron/*` |
| `ALERTS_API_KEY` | generate | Bearer token authorizing `/api/alerts` |
| `REVALIDATION_SECRET` | generate | Bearer token authorizing `POST /api/revalidate` (ISR cache purge) |
| `RETAILER_LINKS_API_KEY` | generate | Bearer token authorizing `POST /api/retailer-links` (admin writes) |
| `ENCRYPTION_KEY` | generate | Encrypts PII at rest |
| `BLIND_INDEX_KEY` | generate (different value) | Subscriber blind-index key |

**Notifications (required for alert delivery):**

| Variable | Source | Description |
|---|---|---|
| `BREVO_API_KEY` | Brevo console | Email sending |
| `BREVO_SENDER_EMAIL` | Brevo console | Verified sender address |
| `BREVO_SENDER_NAME` | — | Optional; defaults to `ThinkaBell` |
| `ONESIGNAL_APP_ID` | OneSignal console | REST app ID |
| `ONESIGNAL_REST_API_KEY` | OneSignal console | REST API key |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | OneSignal console | Browser app ID (Web Push) |

**Affiliate (required for revenue links; links fail closed until set):**

| Variable | Source | Description |
|---|---|---|
| `AMAZON_PARTNER_TAG` | Amazon Associates | US partner tag |
| `AMAZON_PARTNER_TAG_UK` / `_DE` / `_CA` | Amazon Associates | Optional regional tags |
| `EBAY_AFFILIATE_CAMPAIGN_ID` | eBay Partner Network | Campaign ID |
| `AFFILIATE_ATTRIBUTION_ID` | — | Optional; defaults to `thinkabell` |
| `AMAZON_LIST_URLS` | Your curation | JSON array of `{ url, marketplace }` entries (`docs/AMAZON_LIST_CURATION.md`) |

**Optional:**

| Variable | Source | Description |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog console | Analytics (consent-gated) |
| `NEXT_PUBLIC_POSTHOG_HOST` | — | Defaults to `https://app.posthog.com` |
| `EXCHANGE_RATE_API_URL` | — | Defaults to `https://api.frankfurter.app/latest` |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry console | Error tracking (consent-gated) |

**GitHub Actions secrets** (repo Settings → Secrets and variables → Actions) are separate from the above: only `CRON_SECRET` (same value as above) is used by the CI smoke test. The five `HOSTINGER_*` deploy secrets are **no longer needed** — the SCP deploy workflow was removed; deploys run through Hostinger's native GitHub integration (Step 2). Delete any `HOSTINGER_*` secrets you added earlier.

---

### Step 5: Start & Verify Application

1. In the Hostinger Node.js panel, click **Run** or **Restart Application**.
2. Visit `https://thinkabell.click/api/health` to confirm the server, database connection, and Redis cache are green (`200 OK`).
3. Visit `https://thinkabell.click` to test deal browsing, search, and subscriptions.

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

### Build fails on `pnpm install` (Corepack `MODULE_NOT_FOUND`)

If you build **on Hostinger** (native GitHub integration) and it fails during `pnpm install` with a `MODULE_NOT_FOUND` for a path like `~/.cache/node/corepack/v1/pnpm/<version>/bin/pnpm.cjs`, that is a **corrupted Corepack cache** on the build environment — not an invalid pnpm version.

Hostinger runs `pnpm install` **automatically, before your build command** — so a build command that clears the cache cannot fix it (the failure happens first). The fix is in the repository: the `packageManager` field is pinned to **`pnpm@10.34.6`** (the latest pnpm 10.x, matching the lockfile's `lockfileVersion: '9.0'` format, which the pnpm 10 line writes natively). Corepack downloads that version fresh on the build environment — there is no cached entry for it to be corrupted — so the automatic install succeeds.

If you ever hit this again with a different version, clear the Corepack cache once via SSH (hPanel → Advanced → SSH Access; Premium Web or higher): `rm -rf ~/.cache/node/corepack` — the next automatic install re-downloads the pinned version fresh.

### GitHub Pages vs Hostinger

GitHub Pages (`https://<user>.github.io/ThinkaBell/`) only serves static files. ThinkaBell needs a Node.js runtime (API routes, middleware, server components, ISR), so GitHub Pages cannot run the full app — it is a static preview at best. Hostinger Node.js hosting is the production target.
