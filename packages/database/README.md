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
1. Open the Supabase **SQL Editor** in your browser dashboard.
2. Copy the contents of `schema.sql` and click **Run**.
   - This creates `products`, `price_history`, `subscribers`, `alert_queue` tables.
   - Sets up performance indexes.
   - Enables Row Level Security (RLS) and attaches secure policies.
3. Copy the contents of `seed.sql` and click **Run** to populate initial products, price histories, and test subscribers.

### 3. Usage in Code

```typescript
import { ProductRepository, supabase } from "@thinkabell/database";

// Fetch top deals
const deals = await ProductRepository.getTopDeals(20);

// Fetch deal by slug
const deal = await ProductRepository.getBySlug("apple-macbook-pro-14-m3-pro");
```
