# ThinkaBell 🔔

> Real-time deal alert and price tracking platform for AI gadgets, smart home hardware, and developer software.

Monitors prices across **Amazon PA-API 5.0**, **eBay Browse API**, and **Software Affiliate Networks**, with instant push notifications via **OneSignal** and email alerts via **MailerLite**.

---

## 🏗 Architecture Overview

```text
thinkabell/
├── apps/
│   ├── web/               # Next.js 14+ App Router, ISR, Tailwind CSS, OneSignal SDK
│   └── jobs/              # Trigger.dev v3 scheduled tasks (fetchPrices, sendAlerts)
├── packages/
│   ├── config/            # Zod runtime environment validation & app config
│   ├── database/          # Supabase PostgreSQL schema, RLS policies, typed repositories
│   ├── shared/            # Domain types, API clients (Amazon, eBay, OneSignal, MailerLite), Upstash Redis
│   └── edge-worker/       # Cloudflare Worker for edge geo-routing & affiliate link localization
├── scripts/
│   ├── seed-100-products.ts   # Populates database with 100+ realistic hardware & software deals
│   ├── simulate-pipeline.ts   # Full E2E price drop -> alert queue -> notification delivery simulation
│   └── prepare-hostinger.js   # Packages Next.js standalone bundle for Hostinger Node.js hosting
├── docs/
│   ├── HOSTINGER_DEPLOYMENT.md # Hostinger hPanel Node.js setup guide
│   ├── CLOUDFLARE_SETUP.md     # Edge caching, SSL Full (strict), Page Rules, and Worker guide
│   ├── UPTIME_MONITORING.md    # UptimeRobot & Sentry configuration
│   └── LAUNCH_CHECKLIST.md     # Email sequences, social syndication, SEO checklist
├── .github/workflows/
│   └── deploy.yml         # CI/CD pipeline building standalone Next.js & deploying via SCP/SSH
├── turbo.json             # Turborepo task pipeline & caching
└── pnpm-workspace.yaml    # Workspace definition
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20 or v22 (LTS)
- **pnpm**: v9+ / v12+ (`npm install -g pnpm`)

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local` for `apps/web` and `.env` for `apps/jobs`:
```bash
cp .env.example apps/web/.env.local
cp .env.example apps/jobs/.env
```

### 4. Database Setup (Supabase)
1. Create a project at [supabase.com](https://supabase.com).
2. Open the Supabase **SQL Editor** and run `packages/database/schema.sql`.
3. Run `packages/database/seed.sql` to populate initial baseline products.

### 5. Run Development Servers
```bash
# Start Next.js frontend (http://localhost:3000)
pnpm --filter @thinkabell/web dev

# Start Trigger.dev background jobs locally
pnpm --filter @thinkabell/jobs dev
```

---

## 🛠 Useful Monorepo Commands

| Command | Action |
|---|---|
| `pnpm dev` | Run all applications in development mode |
| `pnpm build` | Build all packages and applications via Turborepo |
| `pnpm type-check` | Run TypeScript compilation checks across the monorepo |
| `pnpm lint` | Run ESLint across all apps and packages |
| `pnpm simulate` | Run the full End-to-End price drop simulation test |
| `pnpm prepare:hostinger` | Package standalone build into `dist/hostinger-deploy/` |

---

## 📦 Deployment Guides

- **Hostinger Node.js Hosting**: See [docs/HOSTINGER_DEPLOYMENT.md](docs/HOSTINGER_DEPLOYMENT.md).
- **Cloudflare CDN & Edge Worker**: See [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md).
- **Uptime Monitoring & Health Checks**: See [docs/UPTIME_MONITORING.md](docs/UPTIME_MONITORING.md).
- **Launch & Marketing Playbook**: See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).

---

## 🔒 Security & Compliance

- **Row Level Security (RLS)** is enforced on all Supabase tables.
- **Affiliate Disclosure**: Meets Amazon Associates Operating Agreement and FTC requirements.
- **Rate Limiting**: Sliding-window rate limiting on `/api/subscribe` protects against abuse.
- **Content Security**: Security headers enforced in `next.config.js`.

---

&copy; ThinkaBell (`thinkabell.click`). Built with TypeScript, Next.js, Supabase, Trigger.dev, and Cloudflare.
