# Deployment Requirements — Complete Reference

Every external service this application depends on, with the links to obtain
each credential. Derived from the code (`packages/config/src/env.ts`, the API
clients in `packages/shared/src/api/`, and the `NEXT_PUBLIC_*` init sites), not
from prose — so it reflects what the app actually reads.

For the deployment _procedure_, see [HOSTINGER_DEPLOYMENT.md](./HOSTINGER_DEPLOYMENT.md).
This document is the **what** and the **where from**; that one is the **order**.

---

## 1. Minimum viable deployment

**Only one service is required.** Everything else degrades gracefully, and each
is opt-in.

| Service                                          | Required? | What breaks without it                                                                                                                                  |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase**                                     | **Yes**   | The app cannot start a single query. `getSupabaseAnonClient()` throws, `/api/health` returns `503`, and every deal/search/subscribe route fails closed. |
| Upstash Redis                                    | Optional  | Rate limiting and circuit-breaker state fall back to process-local memory. Works, but state is not shared and resets on restart.                        |
| Amazon PA-API                                    | Optional  | Amazon price checks throw and are contained by the runner; other sources continue.                                                                      |
| Brevo                                            | Optional  | Email alerts are not sent. Push alerts still work if OneSignal is set.                                                                                  |
| OneSignal                                        | Optional  | Browser push is not sent. Email still works if Brevo is set.                                                                                            |
| eBay / Walmart / PartnerStack / Impact / AppSumo | Optional  | That discovery source produces nothing; others continue.                                                                                                |
| PostHog / Sentry                                 | Optional  | Analytics / error reporting are off. No functional impact.                                                                                              |
| Cloudflare worker                                | Optional  | Geo-routing falls back to the default marketplace.                                                                                                      |
| Frankfurter FX                                   | Optional  | Falls back to static rates. Already has a hardcoded default.                                                                                            |

**So you can deploy and be live on Supabase alone**, then enable the rest.

---

## 2. Service-by-service requirements

### 2.1 Supabase — database (REQUIRED)

| What                              | Link                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| Sign up / dashboard               | https://supabase.com/dashboard                                          |
| Project URL + API keys            | Dashboard → your project → **Project Settings → API** (`/settings/api`) |
| Direct Postgres connection string | Dashboard → **Project Settings → Database → Connection string**         |
| SQL editor (schema)               | Dashboard → **SQL Editor** (`/sql`)                                     |
| Extensions (`pg_cron`, `pg_net`)  | Dashboard → **Database → Extensions** (`/database/extensions`)          |

| Variable                        | Where it comes from                                                                                      | Code                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `SUPABASE_URL`                  | Project Settings → API → **Project URL** (`https://<ref>.supabase.co`)                                   | `packages/database/src/client.ts:62` |
| `SUPABASE_ANON_KEY`             | API → **Project API keys → `anon` `public`**                                                             | `client.ts:63`                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | API → **Project API keys → `service_role` `secret`**                                                     | `client.ts:78`                       |
| `NEXT_PUBLIC_SUPABASE_URL`      | Same as `SUPABASE_URL`. **Must be set at build time** — inlined into the browser bundle.                 | `client.ts:66`                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY`. **Build time.**                                                             | `client.ts:67`                       |
| `SUPABASE_DB_URL`               | Connection string (direct Postgres). **Maintenance only** — set in your local `.env`, never on the host. | `scripts/apply-schema.ts:112`        |

Shape validation: the URL must be a real `https://<project-ref>.supabase.co`
host; the key must be a JWT or an `sb_publishable_`/`sb_secret_` key. Supabase's
"Publishable and secret API keys" feature produces the `sb_…` form; the classic
JWT form also works.

**If you already used a different variable name, keep it.** `getEnv()` resolves
any of these spellings into the canonical variable, so a deployment configured under an
alternative name still connects rather than appearing unconfigured. Supabase's own
flows prescribe two different sets, and **both work**:

| Supabase flow                    | Variables it prescribes                                                                | How this app reads them                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Server** (what your host uses) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL` | All four accepted — the first three are canonical or aliases; the JWKS URL is unused (the app performs no user JWT verification). |
| **Next.js App Router**           | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                     | Both accepted; the URL is read directly, the publishable key is an accepted alias for the anonymous key.                          |

| Canonical                   | Accepted aliases (most specific first)                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | `SUPABASE_PROJECT_URL`, `NEXT_PUBLIC_SUPABASE_PROJECT_URL`                                                                                                                 |
| `SUPABASE_ANON_KEY`         | `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_API_KEY`, `NEXT_PUBLIC_SUPABASE_API_KEY`, `NEXT_PUBLIC_SUPABASE_KEY`, `NEXT_PUBLIC_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY`, `SUPABASE_SECRET_API_KEY`, `SUPABASE_SERVICE_KEY`                                                                                                   |
| `IMPACT_ACCOUNT_SID`        | `IMPACT_ACCOUNT_ID`                                                                                                                                                        |
| `IMPACT_AUTH_TOKEN`         | `IMPACT_API_KEY`                                                                                                                                                           |

A canonical variable always takes precedence over an alias. **When more than one
alias is set, the more specific one wins** — `SUPABASE_PUBLISHABLE_KEY` beats the
ambiguous `SUPABASE_API_KEY`, because the former is by definition the anonymous
key in Supabase's key model while the latter has held an anon key, a
service-role key, and a placeholder depending on who set it. Every alias used is
reported — in the startup log and in `/api/health`'s `config` line as
`ok, via non-canonical name(s): SUPABASE_API_KEY→SUPABASE_ANON_KEY` — so the
value works **and** you can see which spelling to normalise to.

> **`SUPABASE_JWKS_URL` and `APPSUMO_API_KEY` are valid to set but unused.** The
> app does not perform user JWT verification, so the JWKS URL is never read
> (`@supabase/supabase-js` handles it internally when needed), and AppSumo is
> harnessed from public pages by design, so it needs no key. Harmless; deleting
> them is optional.

### 2.2 Auditing an existing Hostinger Environment section

If the app looks unconfigured despite the panel showing values, compare the host's
variable list against what the code reads. The canonical list is the Zod schema
in `packages/config/src/env.ts`, plus the handful read directly from
`process.env` (see §6). The mismatches that actually cost you are:

**Read by the code but not set on the host** — the first three fail closed, so the
feature is dead rather than degraded:

| Variable                 | Effect while missing                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `AMAZON_PARTNER_TAG`     | Every Amazon affiliate link fails closed — no link is emitted, so no commission can be attributed. |
| `RETAILER_LINKS_API_KEY` | `POST /api/retailer-links` returns `401`.                                                          |
| `REVALIDATION_SECRET`    | `POST /api/revalidate` returns `401`, so cached pages never purge.                                 |
| `DISCOVERY_SOURCES`      | Nothing is ever discovered — an empty catalogue. See the discovery table below.                    |
| `ENCRYPTION_KEY`         | Subscriber emails and push tokens are stored in plaintext.                                         |
| `BLIND_INDEX_KEY`        | `email_hash` falls back to `lower(email)`, which is not a security control.                        |
| `AMAZON_LIST_URLS`       | The `amazon-list` source is inert — this is the only credential-free way to populate a catalogue.  |

**Set on the host but not read anywhere** — harmless, and safe to remove:
`SUPABASE_JWKS_URL` (the app performs no user JWT verification), and
`APPSUMO_API_KEY` (the AppSumo source harvests public pages by design).

Note that the environment section is not a checklist of what the code reads — it
is a checklist of what the _dashboard_ offered. A variable present there with a
value does not mean anything reads it, and a variable the code reads being absent
produces exactly the "connected on one side, silent on the other" symptom.

### 2.2 Upstash Redis — rate limiting, circuit breakers, FX cache

| What              | Link                                              |
| ----------------- | ------------------------------------------------- |
| Sign up / console | https://console.upstash.com/                      |
| Create a database | Console → **Create Database** (any region, Redis) |

| Variable                   | Where it comes from                                | Code                                    |
| -------------------------- | -------------------------------------------------- | --------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | Database → **REST API → UPSTASH_REDIS_REST_URL**   | `packages/shared/src/utils/redis.ts:55` |
| `UPSTASH_REDIS_REST_TOKEN` | Database → **REST API → UPSTASH_REDIS_REST_TOKEN** | `redis.ts:56`                           |

Both must be set for Upstash to be used; otherwise an in-memory client is
substituted (`redis.ts:71`). Free tier is sufficient.

### 2.3 Brevo — transactional email

| What                | Link                                              |
| ------------------- | ------------------------------------------------- |
| Sign up / app       | https://app.brevo.com/                            |
| API key             | **SMTP & API → API Keys** (`/settings/keys/api`)  |
| Sender verification | **Senders, Domains & Dedicated IPs** (`/senders`) |

| Variable             | Where it comes from                                                                | Code                                               |
| -------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| `BREVO_API_KEY`      | SMTP & API → API Keys → **Create a new API key**                                   | `packages/shared/src/api/notificationClient.ts:77` |
| `BREVO_SENDER_EMAIL` | A **verified** sender address. Must be a valid email or the env schema rejects it. | `notificationClient.ts:79`                         |
| `BREVO_SENDER_NAME`  | Optional; defaults to `ThinkaBell`                                                 | `env.ts:178`                                       |
| `CONTACT_EMAIL`      | Optional                                                                           | `env.ts:180`                                       |

Senders must be verified before mail sends, or Brevo returns an error.

### 2.4 OneSignal — browser push

| What                | Link                                            |
| ------------------- | ----------------------------------------------- |
| Sign up / dashboard | https://dashboard.onesignal.com/                |
| Create app          | **New App/Website** → Web Push → configure site |

| Variable                       | Where it comes from                                                    | Code                             |
| ------------------------------ | ---------------------------------------------------------------------- | -------------------------------- |
| `ONESIGNAL_APP_ID`             | **Settings → Keys & IDs → ONESIGNAL APP ID**                           | `notificationClient.ts:32`       |
| `ONESIGNAL_REST_API_KEY`       | Same page → **REST API KEY**                                           | `notificationClient.ts:36`       |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | Same as `ONESIGNAL_APP_ID`. **Build time** — the browser SDK reads it. | `components/OneSignalGate.tsx:8` |

The client SDK is loaded from `https://cdn.onesignal.com`; that host is already
in the CSP allowlist.

### 2.5 Amazon Associates — affiliate links

| What                     | Link                                                         |
| ------------------------ | ------------------------------------------------------------ |
| Sign up                  | https://affiliate-program.amazon.com/                        |
| Associate Central (tags) | https://affiliate-program.amazon.com/home/account/tag/manage |

| Variable                                | Where it comes from                  | Code                                 |
| --------------------------------------- | ------------------------------------ | ------------------------------------ |
| `AMAZON_PARTNER_TAG`                    | Your US associate tag (`yourtag-20`) | `amazonAffiliateLinkGenerator.ts:36` |
| `AMAZON_PARTNER_TAG_UK` / `_DE` / `_CA` | Regional associate tags              | `env.ts:130-132`                     |

**Links fail closed** — an empty or unknown-marketplace tag raises
`AmazonAffiliateLinkError` rather than generating a link with a missing tag. So
there is no way to ship a revenue link to a marketplace that has no tag.

### 2.6 Amazon PA-API 5.0 — price lookups (optional, needs sales history)

| What        | Link                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| Docs        | https://webservices.amazon.com/paapi5/documentation/                   |
| Credentials | https://affiliate-program.amazon.com/home/account/security/credentials |

| Variable            | Where it comes from               | Code                 |
| ------------------- | --------------------------------- | -------------------- |
| `AMAZON_ACCESS_KEY` | Associates Central → credentials  | `amazonClient.ts:76` |
| `AMAZON_SECRET_KEY` | Same                              | `amazonClient.ts:77` |
| `AMAZON_REGION`     | Optional; defaults to `us-east-1` | `env.ts:126`         |

Note: Amazon PA-API requires 3 qualified sales in 180 days to stay eligible.
New accounts get no access, which is why discovery starts with eBay/AppSumo and
curated lists.

### 2.7 Amazon List curation — public lists, no API key

No signup. Curate public Amazon List (Idea List) URLs and the app harvests them
with no Amazon login. See [AMAZON_LIST_CURATION.md](./AMAZON_LIST_CURATION.md).

| Variable                     | Notes                                | Code                     |
| ---------------------------- | ------------------------------------ | ------------------------ |
| `AMAZON_LIST_URLS`           | JSON array of `{ url, marketplace }` | `amazonListClient.ts:37` |
| `AMAZON_LIST_MARKETPLACE`    | Default `US`                         | `env.ts:139`             |
| `AMAZON_LIST_MAX_ITEMS`      | Default `100`                        | `env.ts:141`             |
| `AMAZON_LIST_FETCH_DELAY_MS` | Default `1000` (politeness delay)    | `env.ts:143`             |

Images come from `m.media-amazon.com`, which is in the Next.js image allowlist.

### 2.8 eBay Partner Network — Browse API + affiliate

| What                       | Link                               |
| -------------------------- | ---------------------------------- |
| Sign up (verified current) | https://partnernetwork.ebay.com/   |
| Developer app (Browse API) | https://developer.ebay.com/my/keys |
| Campaign ID                | Dashboard → **Campaigns**          |

| Variable                     | Where it comes from                                   | Code               |
| ---------------------------- | ----------------------------------------------------- | ------------------ |
| `EBAY_CLIENT_ID`             | developer.ebay.com → **My Keys → App ID (Client ID)** | `ebayClient.ts:48` |
| `EBAY_CLIENT_SECRET`         | Same page → **Cert ID (Client Secret)**               | `ebayClient.ts:49` |
| `EBAY_AFFILIATE_CAMPAIGN_ID` | ePN dashboard → Campaigns                             | `env.ts:157`       |

OAuth goes to `https://api.ebay.com/identity/v1/oauth2/token`; the Browse API
base is `https://api.ebay.com/buy/browse/v1`. Images come from `i.ebayimg.com`
(allowlisted). This is the best starting partner: no sales-history gate.

### 2.9 Walmart — optional

| What                          | Link                                         |
| ----------------------------- | -------------------------------------------- |
| Affiliate program             | https://affiliates.walmart.com/              |
| Creator program (individuals) | https://creator.walmart.com/                 |
| Login                         | https://affiliates.walmart.com/account/login |

| Variable                     | Where it comes from                                    | Code                  |
| ---------------------------- | ------------------------------------------------------ | --------------------- |
| `WALMART_API_KEY`            | Affiliate dashboard API key. Sent as `X-RapidAPI-Key`. | `walmartClient.ts:52` |
| `WALMART_AFFILIATE_ID`       | Your publisher/publisher ID                            | `env.ts:161`          |
| `WALMART_AFFILIATE_TRACK_ID` | Tracking ID                                            | `env.ts:162`          |

### 2.10 PartnerStack / Impact — SaaS deals (optional)

| Service      | Sign up                   | Dashboard / keys                                                                                                                                                                                  | Code                       |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| PartnerStack | https://partnerstack.com/ | https://dashboard.partnerstack.com/ → Settings → API Keys → `PARTNERSTACK_API_KEY`                                                                                                                | `partnerStackClient.ts:50` |
| Impact       | https://impact.com/       | https://app.impact.com/ → **[User profile] → Settings → Technical → API → Create Access Token**, then **API Credentials** on the token's detail page → `IMPACT_ACCOUNT_SID` + `IMPACT_AUTH_TOKEN` | `impactClient.ts:111`      |

Both authenticate over HTTP Basic with the pair (Account SID as username, Auth
Token as password). Impact's partner base path is
`https://api.impact.com/MediaPartners/{AccountSid}/…` — **`MediaPartners` with a
capital P**. Its routes are case-sensitive, so the earlier `Mediapartners`
spelling returned 404 and the source silently yielded no offers. If Impact
reports nothing while the credentials are valid, check this casing first.

### 2.11 AppSumo — SaaS deals, zero credentials

| What   | Link                        |
| ------ | --------------------------- |
| Source | https://appsumo.com/browse/ |

Needs no signup and no env vars — it harvests public pages (`appSumoClient.ts`).
This is the fastest way to have a populated catalogue with no accounts at all.

### 2.12 Frankfurter — FX rates

| What         | Link                                                          |
| ------------ | ------------------------------------------------------------- |
| API / status | https://frankfurter.dev/ · https://api.frankfurter.app/latest |

| Variable                | Notes                                                                                    | Code                        |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| `EXCHANGE_RATE_API_URL` | Defaults to `https://api.frankfurter.app/latest`; falls back to static rates on failure. | `exchangeRateService.ts:76` |

No key required.

### 2.13 PostHog — product analytics (optional)

| What            | Link                                                   |
| --------------- | ------------------------------------------------------ |
| Sign up / app   | https://app.posthog.com/ (EU: https://eu.posthog.com/) |
| Project API key | **Project Settings → Project API Key**                 |

| Variable                   | Where it comes from                                                                        | Code               |
| -------------------------- | ------------------------------------------------------------------------------------------ | ------------------ |
| `NEXT_PUBLIC_POSTHOG_KEY`  | Project API Key (`phc_…`). **Build time.**                                                 | `lib/posthog.ts:8` |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional; defaults to `https://app.posthog.com`. EU projects set `https://eu.posthog.com`. | `lib/posthog.ts:9` |

Consent-gated (`consent === "all"`), and the host must be in the CSP allowlist —
`middleware.ts` adds it dynamically from this variable, so a custom host works
without a code change.

### 2.14 Sentry — error tracking (optional)

| What                     | Link                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Sign up / org            | https://sentry.io/                                                                              |
| DSN                      | **Settings → Projects → [project] → Client Keys (DSN)**                                         |
| Auth token (source maps) | **Settings → Auth Tokens → Create New Token** (`project:releases`, `org:read`, `project:write`) |

| Variable                        | Where it comes from                                                               | Code                            |
| ------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| `SENTRY_DSN`                    | Client Keys (DSN). Empty = Sentry never initialises.                              | `apps/web/instrumentation.ts:8` |
| `NEXT_PUBLIC_SENTRY_DSN`        | Same value. **Build time.**                                                       | `sentry.client.config.ts:7`     |
| `SENTRY_TRACES_SAMPLE_RATE`     | Optional; defaults to `0.1`                                                       | `instrumentation.ts:14`         |
| `SENTRY_AUTH_TOKEN`             | **Build time only.** Enables source-map upload; absent = upload silently skipped. | `next.config.js:59`             |
| `SENTRY_ORG` / `SENTRY_PROJECT` | **Build time only.** Validated as slugs; a typo is reported by name.              | `next.config.js:60-61`          |

Both DSNs are shape-validated; a placeholder is rejected rather than sent. The
org and project slugs are validated too, so a malformed one is reported instead
of failing the upload or shipping maps to the wrong project. Step-by-step setup,
including how the three build-time variables fit together, is
[docs/SENTRY_SETUP.md](./SENTRY_SETUP.md).

### 2.15 Cloudflare — DNS and optional edge geo-routing

| What                          | Link                                        |
| ----------------------------- | ------------------------------------------- |
| Dashboard                     | https://dash.cloudflare.com/                |
| DNS records                   | Dashboard → your domain → **DNS → Records** |
| Cache rules                   | Dashboard → **Rules → Cache Rules**         |
| Workers (optional geo header) | Dashboard → **Workers & Pages**             |

| Variable             | Where it comes from                                                                                          | Code                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `EDGE_PROXY_TRUSTED` | `true` **only** when the Cloudflare worker fronts the origin. Never used for authorization. Default `false`. | `georouter.ts:47`      |
| `ORIGIN_URL`         | **Worker-side only** (Cloudflare Worker environment), not in the app schema.                                 | `packages/edge-worker` |

**Never set `EDGE_PROXY_TRUSTED=true` without the worker** — it makes the origin
trust a client-supplied `x-thinkabell-country` header, which would let a caller
choose their own marketplace.

### 2.16 Hostinger — hosting

| What                  | Link                                     |
| --------------------- | ---------------------------------------- |
| Sign up / hPanel      | https://hpanel.hostinger.com/            |
| Node.js app           | hPanel → **Websites → [site] → Node.js** |
| Environment variables | Node.js panel → **Environment**          |
| Runtime logs          | Node.js panel → **Runtime Logs**         |
| Cron jobs (fallback)  | hPanel → **Advanced → Cron Jobs**        |

### 2.17 GitHub — source and CI

| What                               | Link                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| Repository                         | https://github.com/                                   |
| Actions secrets (CI smoke test)    | Repo → **Settings → Secrets and variables → Actions** |
| GitHub App (Hostinger integration) | Repo → **Settings → Installations**                   |

Only `CRON_SECRET` is needed as a GitHub Actions secret (same value as the host).

---

## 3. Secrets you generate yourself

```bash
# Two DIFFERENT values for PII protection (64-char hex = 32 bytes)
openssl rand -hex 32   # -> ENCRYPTION_KEY
openssl rand -hex 32   # -> BLIND_INDEX_KEY

# API bearer tokens (any long random value)
openssl rand -hex 24   # -> CRON_SECRET
openssl rand -hex 24   # -> ALERTS_API_KEY
openssl rand -hex 24   # -> REVALIDATION_SECRET
openssl rand -hex 24   # -> RETAILER_LINKS_API_KEY
```

| Variable                 | Purpose                                                                                                                       | Code                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `ENCRYPTION_KEY`         | AES-256-GCM for PII at rest. Pass-through when unset. Must be 64-char hex.                                                    | `fieldEncryption.ts:28`      |
| `BLIND_INDEX_KEY`        | HMAC-SHA256 blind index for `subscribers.email_hash`. Falls back to `lower(email)` — **not a security control** — when unset. | `blindIndex.ts:51`           |
| `CRON_SECRET`            | Bearer token for `/api/cron/*`. **Also goes into the `cron_secret` row in Supabase.**                                         | `app/api/cron/*/route.ts:10` |
| `ALERTS_API_KEY`         | Bearer token for `/api/alerts`                                                                                                | `app/api/alerts/route.ts:26` |
| `REVALIDATION_SECRET`    | Bearer token for `POST /api/revalidate`                                                                                       | `env.ts:203`                 |
| `RETAILER_LINKS_API_KEY` | Bearer token for `POST /api/retailer-links`                                                                                   | `env.ts:204`                 |

All four API tokens fail closed: an empty token rejects every request.

**`ENCRYPTION_KEY` and `BLIND_INDEX_KEY` are read directly from `process.env`** by
`packages/shared` and are **not** in the env schema, so they never appear in the
`config` line of `/api/health`. They are validated only by their own regex.

---

## 4. Image host allowlist

Next.js will only optimize images from these hosts (`apps/web/next.config.js:10-16`):

| Host                  | Used by                         |
| --------------------- | ------------------------------- |
| `images.unsplash.com` | Placeholder/seed imagery        |
| `m.media-amazon.com`  | Amazon products and Amazon List |
| `i.ebayimg.com`       | eBay products                   |

A product whose image is on another host will not render through
`/_next/image`. The browser-facing CSP is broader (`img-src 'self' data: https:`)
than this server-side allowlist, so a non-allowlisted host fails at optimization,
not at the CSP check.

---

## 5. Complete ordered runbook

### Phase 1 — accounts (no deployment yet)

1. Create the GitHub repo and push `main`.
2. Supabase → create a project → note **Project URL**, `anon` key, `service_role` secret, and the **direct Postgres connection string**.
3. Upstash → create a Redis database → copy the REST URL and token.
4. Optional: Brevo, OneSignal, eBay Partner Network, PostHog, Sentry, Cloudflare, Amazon Associates, Walmart, PartnerStack, Impact.

### Phase 2 — secrets

5. Generate `ENCRYPTION_KEY` and `BLIND_INDEX_KEY` (**different** values) and the four API tokens with `openssl rand -hex`.
6. Apply the schema: `pnpm db:apply` with `SUPABASE_DB_URL` set locally.
7. Enable `pg_cron` + `pg_net` extensions, then insert the `cron_settings` rows and run `schedule_thinkabell_crons()`.

### Phase 3 — Hostinger

8. Create the Node.js app (**type `Other`**, Node **22.x**, pnpm, root `./`, build `pnpm run build:standalone`, entry `apps/web/hostinger-server.js`).
9. Add **every** environment variable from this document in the **Environment** section — **before the first build**, because `NEXT_PUBLIC_*` values are inlined at build time.
10. Restart.

### Phase 4 — deploy and verify

11. `git push origin main`.
12. `GET /api/health` → expect `config: "ok"`, `database: "ok"`, `cache: "ok"`.
13. `pnpm run check:supabase` on the host → all five stages pass.
14. Trigger `/api/cron/product-discovery` with `CRON_SECRET` → confirm products appear.

---

## 6. Variables that never appear in `/api/health`

These are read directly from `process.env`, so the `config` check cannot see them.
If one is wrong, `/api/health` still reports `config: "ok"`.

| Variable                                            | Read by           | Failure mode                             |
| --------------------------------------------------- | ----------------- | ---------------------------------------- |
| `DISCOVERY_SOURCES`                                 | `apps/jobs`       | Logged by the runner; zero products      |
| `ENCRYPTION_KEY`                                    | `packages/shared` | PII stored in plaintext                  |
| `BLIND_INDEX_KEY`                                   | `packages/shared` | Blind index falls back to `lower(email)` |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | `next.config.js`  | Source maps silently not uploaded        |
| `OUTPUT`                                            | `next.config.js`  | Build emits no standalone output         |
| `SUPABASE_DB_URL`, `SUPABASE_DB_CONNECTION_STRING`  | `scripts/`        | Migration/backup fails                   |
| `ORIGIN_URL`                                        | Cloudflare worker | Worker cannot reach the origin           |
