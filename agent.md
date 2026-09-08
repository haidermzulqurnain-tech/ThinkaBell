# ThinkABell Project – AI Agent Guidelines

## Project Overview

ThinkABell is a deal alert platform for AI gadgets and smart home products. It monitors prices on Amazon, eBay, and software affiliate networks, and notifies users via push and email when prices drop.

## Architecture

- **Frontend:** Next.js 14 (App Router) hosted on Hostinger Node.js
- **Database:** Supabase (PostgreSQL)
- **Background Jobs:** Trigger.dev (serverless)
- **Caching/Rate Limiting:** Upstash Redis
- **CDN:** Cloudflare
- **Notifications:** OneSignal (push), MailerLite (email)
- **Analytics:** PostHog
- **Monorepo:** pnpm workspaces + Turborepo

## Directory Structure
thinkabell/
├── apps/
│ ├── web/ # Next.js frontend
│ └── jobs/ # Trigger.dev background jobs
├── packages/
│ ├── shared/ # Shared types, API clients, utilities
│ ├── database/ # Supabase client, Prisma schema (if used)
│ └── config/ # Environment validation (Zod)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json


## Environment Variables

Place `.env` files in relevant app/package folders. Do NOT commit these files.

- **web** (`.env.local`): 
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_ONESIGNAL_APP_ID`
  - `NEXT_PUBLIC_POSTHOG_KEY`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **jobs** (`.env`):
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, `AMAZON_ASSOCIATE_TAG`, `AMAZON_PARTNER_TAG`
  - `EBAY_APP_ID`
  - `ONESIGNAL_API_KEY`, `ONESIGNAL_APP_ID`
  - `MAILERLITE_API_KEY`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **shared** can read from environment via a centralized config.

## Commands

- Install: `pnpm install`
- Dev frontend: `pnpm --filter web dev`
- Build frontend: `pnpm --filter web build`
- Run jobs locally: `npx trigger.dev@latest dev`
- Deploy jobs: `npx trigger.dev@latest deploy`
- Lint: `pnpm lint`
- Type-check: `pnpm typecheck`

## Coding Conventions

- TypeScript strict mode enabled.
- Use functional React components and hooks.
- Server Components by default; use `"use client"` only when needed.
- API routes in `app/api/` should validate input using Zod.
- All shared code must be in `packages/shared` and exported via `index.ts`.
- Database access: use `@thinkabell/database` package which exports a Supabase client.
- Background jobs must be idempotent (safe to re-run).
- Use `p-limit` for concurrency in API calls.
- Error handling: log errors in jobs, return proper HTTP status in API.
- Environment variables: use `packages/config` to validate and access.

## Common Tasks for Agent

### 1. Add a new product data source (e.g., Walmart)
- Create new client in `packages/shared/src/api/walmartClient.ts`
- Add type definitions in `packages/shared/src/types.ts`
- Update `fetchPrices` job to call new client
- Update product table schema if needed

### 2. Add a new page
- Create file in `apps/web/app/` (e.g., `app/about/page.tsx`)
- Use static generation if possible; otherwise ISR with `revalidate`
- Fetch data from Supabase using `@thinkabell/database`
- Add route to sitemap if applicable

### 3. Add a new background job
- Create file in `apps/jobs/src/jobs/`
- Define using `task` from `@trigger.dev/sdk/v3`
- Add schedule if needed
- Deploy job

### 4. Modify notification content
- Edit `notificationClient.ts` in `packages/shared`
- Ensure both push and email templates are updated

### 5. Add rate limiting to an API route
- Use `rateLimit` function from `packages/shared`
- Example: `const allowed = await rateLimit(`key:${ip}`, 5, 60);`

### 6. Add caching
- Use `redis` from `packages/shared` (Upstash client)
- Cache frequently accessed data with TTL

## Testing

- No unit tests yet; if added, use Vitest.
- Test API routes manually using Postman or curl.
- Test jobs locally with Trigger.dev dev environment.

## Deployment

- Frontend: Push to `main` branch triggers GitHub Actions workflow; it builds and SCPs to Hostinger.
- Jobs: Push to `main` triggers Trigger.dev auto-deploy (if connected) or run `npx trigger.dev@latest deploy`.
- Database migrations: apply manually via Supabase SQL editor or CLI.

## Important Notes

- Do not commit `.env` files or any secrets.
- Keep API calls to external services within rate limits (Amazon: 1 req/s, eBay: 5000/day).
- The `alert_queue` table may grow; consider purging old sent alerts periodically.
- When adding new affiliate networks, update the `affiliate_links` JSONB structure and the frontend rendering.

---

This agent.md is intended to guide AI coding tools to make consistent, correct changes to the codebase.
