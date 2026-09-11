# Hostinger Node.js Deployment Guide

This guide details how to deploy the **ThinkaBell** Next.js 14+ application to Hostinger Node.js hosting.

---

## Architecture on Hostinger

Next.js is configured in **standalone mode** (`output: 'standalone'` in `next.config.js`). This builds a self-contained Node.js server containing only the production dependencies needed to run the website.

---

## Step-by-Step Deployment Walkthrough

### Step 1: Build the Standalone Bundle Locally

```bash
# In the root repository
pnpm install
pnpm --filter @thinkabell/web build
node scripts/prepare-hostinger.js
```

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

In the Hostinger Node.js control panel, add the following environment variables:

| Variable | Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (or leave default if Hostinger assigns dynamic port) |
| `NEXT_PUBLIC_APP_URL` | `https://thinkabell.click` |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase public anon key |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase public anon key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | OneSignal App ID for Web Push |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog Public Key for Analytics |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://app.posthog.com` |

---

### Step 5: Start & Verify Application

1. In the Hostinger Node.js panel, click **Run** or **Restart Application**.
2. Visit `https://thinkabell.click/api/health` to confirm the server, database connection, and Redis cache are green (`200 OK`).
3. Visit `https://thinkabell.click` to test deal browsing, search, and subscriptions.
