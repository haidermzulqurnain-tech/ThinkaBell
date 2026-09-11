-- ThinkaBell Supabase Database Schema
-- Run this script in the Supabase SQL Editor or via Supabase CLI

-- 1. Create Tables

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('physical', 'software')) NOT NULL,
    brand TEXT,
    amazon_asin TEXT,
    ebay_epid TEXT,
    affiliate_links JSONB DEFAULT '{}'::jsonb,
    current_price NUMERIC(10, 2),
    previous_price NUMERIC(10, 2),
    price_updated_at TIMESTAMPTZ,
    image_url TEXT,
    description TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price History Table
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    source TEXT NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscribers Table
CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    push_subscription_id TEXT,
    preferences JSONB DEFAULT '{"categories": ["physical", "software"], "min_discount": 10}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Queue Table
CREATE TABLE IF NOT EXISTS alert_queue (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    old_price NUMERIC(10, 2) NOT NULL,
    new_price NUMERIC(10, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    last_error TEXT
);

-- 2. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price_updated ON products(price_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_queue_sent ON alert_queue(sent) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);

-- 3. Automatic Updated_At Trigger Function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_products_updated_at ON products;
CREATE TRIGGER tr_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- 4. Row Level Security (RLS) Configuration
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_queue ENABLE ROW LEVEL SECURITY;

-- Products Policies: Public read, Service Role write
DROP POLICY IF EXISTS "Public can view products" ON products;
CREATE POLICY "Public can view products"
    ON products FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Service role full access to products" ON products;
CREATE POLICY "Service role full access to products"
    ON products FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Price History Policies: Public read, Service Role write
DROP POLICY IF EXISTS "Public can view price history" ON price_history;
CREATE POLICY "Public can view price history"
    ON price_history FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Service role full access to price history" ON price_history;
CREATE POLICY "Service role full access to price history"
    ON price_history FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Subscribers Policies: Public can insert/upsert, Service Role full access
DROP POLICY IF EXISTS "Public can subscribe" ON subscribers;
CREATE POLICY "Public can subscribe"
    ON subscribers FOR INSERT
    TO anon, authenticated
    WITH CHECK (email IS NOT NULL AND position('@' in email) > 1);

DROP POLICY IF EXISTS "Public can update own subscription" ON subscribers;
CREATE POLICY "Public can update own subscription"
    ON subscribers FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (email IS NOT NULL);

DROP POLICY IF EXISTS "Service role full access to subscribers" ON subscribers;
CREATE POLICY "Service role full access to subscribers"
    ON subscribers FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Alert Queue Policies: Service Role only (background workers)
DROP POLICY IF EXISTS "Service role full access to alert_queue" ON alert_queue;
CREATE POLICY "Service role full access to alert_queue"
    ON alert_queue FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
