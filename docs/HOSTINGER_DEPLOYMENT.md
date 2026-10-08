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

#### Option A: Via GitHub Actions (Recommended)
Pushing to the `main` branch automatically builds, bundles, and securely uploads to Hostinger via SCP using `.github/workflows/deploy.yml`.

#### Option B: Via File Manager / SFTP
1. Compress the contents of `dist/hostinger-deploy/` into a `.zip` file.
2. In Hostinger **File Manager**, upload the zip file to your **Application Root** (`public_html`).
3. Extract the zip file in place.
4. Verify that `hostinger-server.js`, `apps/`, and `.next/` exist in `public_html`.

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
