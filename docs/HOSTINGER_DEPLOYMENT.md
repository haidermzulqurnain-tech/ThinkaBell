# Hostinger Node.js Deployment Guide

This guide details how to deploy the **ThinkaBell** Next.js 14+ application to Hostinger Node.js hosting.

---

## Architecture on Hostinger

Next.js can build in **standalone mode** (`output: "standalone"` in `next.config.js`, enabled by `pnpm build:standalone`). This builds a self-contained Node.js server containing only the production dependencies needed to run the website.

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

1. Log into your **Hostinger Control Panel (hPanel)**.
2. Navigate to **Websites** -> Select **thinkabell.click** -> Click **Manage**.
3. Under the **Advanced** or **Server** section, locate **Node.js**.
4. Configure the following settings:
   - **Node.js Version**: Select **20.x** or **22.x** (LTS).
   - **Application Root**: The directory where your files will reside:
     - Example: `public_html` or a subfolder like `domains/thinkabell.click/public_html`
   - **Application Startup File**: `hostinger-server.js`
   - **Application Mode**: `Production`

---

### Step 3: Upload Files to Hostinger

The deployable files are the **built standalone bundle** in `dist/hostinger-deploy/` — **not** the raw repository files. The raw repo (source code, `package.json`, `apps/`, `packages/`, `scripts/`) cannot run on Hostinger: it has no `node_modules` and no `.next/standalone` build output, so `hostinger-server.js` cannot start. If your Hostinger Application Root currently contains the raw repo files, replace them with the built bundle using one of the options below.

#### Option A: Via GitHub Actions (Recommended)
Pushing to the `main` branch (or **Actions → Deploy to Hostinger → Run workflow**) builds the standalone bundle on a Linux runner and uploads it to Hostinger via SCP using `.github/workflows/deploy.yml`. This requires the five `HOSTINGER_*` repository secrets (see Troubleshooting).

#### Option B: Via the workflow artifact (no SSH secrets needed)
The workflow always attaches the built bundle as a **`hostinger-deploy` artifact** — even when the `HOSTINGER_*` secrets are missing (the automatic SCP deploy is skipped, but the artifact is still produced on GitHub's Linux runner, so no local build or symlink support is required):
1. Run **Actions → Deploy to Hostinger → Run workflow**.
2. Open the run → **Artifacts** → download **`hostinger-deploy`**.
3. Extract the zip. Its contents (`hostinger-server.js`, `apps/`, `.next/`, `node_modules/`, `package.json`) are the deployable files.
4. In Hostinger **File Manager**, upload them to your **Application Root** (`public_html`), replacing the raw repository files.
5. Verify that `hostinger-server.js`, `apps/`, and `.next/` exist in `public_html`.

#### Option C: Build locally, then upload
1. Run `pnpm package:hostinger` (requires symlink support — on Windows, enable Developer Mode, or use Option B instead).
2. Compress the contents of `dist/hostinger-deploy/` into a `.zip` file.
3. In Hostinger **File Manager**, upload the zip to your **Application Root** (`public_html`) and extract it.

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

**GitHub Actions secrets** (repo Settings → Secrets and variables → Actions) are separate from the above and only needed for the automated deploy: `HOSTINGER_HOST`, `HOSTINGER_USERNAME`, `HOSTINGER_PASSWORD`, `HOSTINGER_PORT`, `HOSTINGER_DEPLOY_PATH`, plus `CRON_SECRET` (same value as above, used by the CI smoke test).

---

### Step 5: Start & Verify Application

1. In the Hostinger Node.js panel, click **Run** or **Restart Application**.
2. Visit `https://thinkabell.click/api/health` to confirm the server, database connection, and Redis cache are green (`200 OK`).
3. Visit `https://thinkabell.click` to test deal browsing, search, and subscriptions.

---

## Troubleshooting

### "Linked the GitHub repo in hPanel" is not enough

Hostinger's **native GitHub integration** (hPanel → GitHub → connect repo) only pulls the repository files — it does **not** run `pnpm install` or `pnpm build:standalone`. ThinkaBell is a Next.js App Router monorepo that must be compiled into a standalone server before it can run, so a raw repo checkout has no `node_modules` and no `.next/standalone` output, and `hostinger-server.js` cannot start. This is the most common cause of a failed Hostinger deploy.

**Use the GitHub Actions workflow instead** (`.github/workflows/deploy.yml`), which builds, packages, and uploads the standalone bundle to Hostinger over SCP. To enable it:

1. In GitHub, go to **repo Settings → Secrets and variables → Actions** and add the five deploy secrets:
   - `HOSTINGER_HOST` — your Hostinger server IP/hostname (hPanel → Hosting → SSH/FTP details)
   - `HOSTINGER_USERNAME` — SSH username
   - `HOSTINGER_PASSWORD` — SSH password
   - `HOSTINGER_PORT` — SSH port (usually `65002` on Hostinger)
   - `HOSTINGER_DEPLOY_PATH` — absolute path to the app directory on the server (e.g. `/home/u123456789/domains/thinkabell.click/public_html`)
2. Push to `main` (or run **Actions → Deploy to Hostinger → Run workflow**).

The workflow fails fast if any secret is missing, then builds the standalone bundle, packages `dist/hostinger-deploy/`, verifies it, uploads it via SCP, and touches `hostinger-server.js` to trigger a restart.

### Workflow says the secrets are empty even though I added them

Per the [GitHub Actions secrets docs](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions), repository and organization secrets are **read when a workflow run is queued** — a run queued before you saved the secrets will not see them (GitHub does not inject secrets into a run retroactively). **Re-run the workflow** (**Actions → Deploy to Hostinger → Run workflow**) after saving the secrets. If it still reports them empty, check in this order:

1. **Fork** — "secrets are not passed to the runner when a workflow is triggered from a forked repository." If the repo running the workflow is a fork, the secrets must be added to **that fork** (the repo that actually runs the workflow), not the upstream original.
2. **Environment-secret precedence** — an *Environment* secret with the same name takes precedence over a *Repository* secret, and environment secrets are only available to jobs that reference that environment (this job does not). If you accidentally created the secrets under an **Environment**, delete them and re-add them as **Repository secrets** (Settings → Secrets and variables → Actions → **Repository secrets** tab → New repository secret).
3. **Organization-secret access** — an *Organization* secret is empty unless explicitly granted access to this repository (Organization Settings → Secrets → the secret → Repository access). Prefer repository-level secrets.
4. **Names** — secret names may only contain alphanumeric characters and underscores, and are stored uppercase (case-insensitive when referenced). Confirm the five names: `HOSTINGER_HOST`, `HOSTINGER_USERNAME`, `HOSTINGER_PASSWORD`, `HOSTINGER_PORT`, `HOSTINGER_DEPLOY_PATH`.
5. **Same repository** — the secrets must be in the repository that runs the workflow (the one linked to Hostinger), not a different repo.

> Verify what GitHub actually sees: run `gh secret list --repo <owner>/<repo>` (names only — values are never shown) to confirm the five secrets exist at the repository level.

**Hostinger SSH prerequisites** (the SCP/SSH steps run after the secret check): SSH is available on **Premium Web and higher** plans (not Single Web); enable it in hPanel → **Advanced → SSH Access**. The connection uses port **65002** (not 22), the server **IP** shown on the SSH Access page, and the username `uXXXXXX` (your Hostinger system user — **not** your hPanel login email). `HOSTINGER_DEPLOY_PATH` is the absolute web root, e.g. `/home/uXXXXXX/domains/thinkabell.click/public_html`.

### Preflight check

Run the fail-closed preflight checker locally to see exactly what is missing before you deploy:

```bash
pnpm verify:hostinger
```

It reports `[PASS]`/`[WARN]`/`[FAIL]` for the standalone build, entrypoint, packaged bundle, runtime environment variables, and deploy-workflow secrets, and exits non-zero if the bundle would ship broken.

### App starts but `/api/health` is unhealthy

The server is up but a fail-closed integration is unconfigured. Set the **Core**, **Security**, **Notifications**, and **Affiliate** variables in Step 4 on the Hostinger Node.js panel (**Environment** section), then **Restart Application**. The most common gaps are `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (database) and `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (cache).

### GitHub Pages vs Hostinger

GitHub Pages (`https://<user>.github.io/ThinkaBell/`) only serves static files. ThinkaBell needs a Node.js runtime (API routes, middleware, server components, ISR), so GitHub Pages cannot run the full app — it is a static preview at best. Hostinger Node.js hosting is the production target.
