# Uptime Monitoring & Observability Guide

Learn how to configure 24/7 uptime monitoring and error observability for **thinkabell.click**.

---

## 1. Uptime Monitoring (UptimeRobot)

We recommend using [UptimeRobot](https://uptimerobot.com/) (free tier includes 50 monitors with 5-minute intervals).

### Step 1: Create a Monitor
1. Log in to your UptimeRobot account.
2. Click **+ Add New Monitor**.
3. Fill in the following details:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `ThinkaBell Health Check`
   - **URL (or IP)**: `https://thinkabell.click/api/health`
   - **Monitoring Interval**: `5 minutes`
   - **Monitor Timeout**: `30 seconds`

### Step 2: Configure Keyword / Status Alerting
1. Under **Advanced Settings**:
   - Verify HTTP status code expects `200 OK`.
   - Optionally check that response body contains `"status":"healthy"`.
2. Select notification recipients (your email, SMS, or webhook for Slack / Discord / Telegram).
3. Click **Create Monitor**.

---

## 2. Error Tracking (Sentry)

1. Create a free project at [sentry.io](https://sentry.io) for **Next.js**.
2. Copy your **Sentry DSN**.
3. Add the DSN to your environment variables:
   ```env
   SENTRY_DSN=https://your-dsn@o0.ingest.sentry.io/0
   NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o0.ingest.sentry.io/0
   ```
4. Frontend runtime errors and API 500 exceptions will be automatically tracked with breadcrumbs and user session details.

---

## 3. Product Analytics (PostHog)

1. Create a free project at [posthog.com](https://posthog.com).
2. Copy your **Project API Key**.
3. Add the key to your `.env.local` or Hostinger environment:
   ```env
   NEXT_PUBLIC_POSTHOG_KEY=phc_your_posthog_project_key
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   ```
4. Key tracked events in ThinkaBell:
   - `pageview`: When any page is loaded
   - `deal_card_click`: When a user clicks a deal card or "View Deal" button
   - `push_permission_granted`: When a user allows OneSignal push notifications
   - `subscription_successful`: When a user submits their email alert preferences.
