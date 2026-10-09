# @thinkabell/database

Data Access Layer, database migrations, seed scripts, and Supabase client configuration for ThinkaBell.

## Setup Instructions

### 1. Supabase Project Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** -> **API** to copy:
   - **Project URL** (`SUPABASE_URL`)
   - **Anon Public Key** (`SUPABASE_ANON_KEY`)
   - **Service Role Secret Key** (`SUPABASE_SERVICE_ROLE_KEY`)

### 2. Apply Schema & Seed Data

**Option A — scripted (recommended, repeatable):**

The schema is applied over a direct Postgres connection by
`pnpm db:apply`, which reads `schema.sql` and runs it
transactionally. `schema.sql` is fully idempotent, so it is
safe to re-run.

```bash
# Set the admin connection string (local .env or CI secret —
# never on the app host). Get it from Supabase Dashboard →
# Project Settings → Database → Connection string.
SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" pnpm db:apply
```

Supabase's managed Postgres reloads the PostgREST schema
cache automatically on DDL, so no manual cache refresh is
needed afterwards.

**Option B — manual:**

1. Open the Supabase **SQL Editor** in your browser dashboard.
2. Copy the contents of `schema.sql` and click **Run**.
3. Copy the contents of `seed.sql` and click **Run** to populate
   initial products, price histories, and test subscribers
   (development only — `seed.sql` truncates and reseeds every
   table, so never run it against production data).

### 3. Usage in Code

```typescript
import { ProductRepository, supabase } from "@thinkabell/database";

// Fetch top deals
const deals = await ProductRepository.getTopDeals(20);

// Fetch deal by slug
const deal = await ProductRepository.getBySlug("apple-macbook-pro-14-m3-pro");
```
