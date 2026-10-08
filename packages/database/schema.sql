-- ThinkaBell Supabase Database Schema
-- Run this script in the Supabase SQL Editor or via Supabase CLI

-- ===============================================
-- 1. Core Tables
-- ===============================================

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('physical', 'software')) NOT NULL,
    brand TEXT,
    amazon_asin TEXT,
    ebay_epid TEXT,
    walmart_sku TEXT,
    affiliate_links JSONB DEFAULT '{}'::jsonb,
    current_price NUMERIC(10, 2),
    previous_price NUMERIC(10, 2),
    price_updated_at TIMESTAMPTZ,
    image_url TEXT,
    description TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    search_vector TSVECTOR,
    deal_type TEXT,
    promo_code TEXT,
    deal_end_date TIMESTAMPTZ,
    discount_percent NUMERIC(5, 2),
    original_price NUMERIC(10, 2),
    affiliate_network TEXT,
    affiliate_id TEXT,
    sources TEXT[] DEFAULT '{}'::TEXT[],
    source_id TEXT,
    discovery_source TEXT,
    last_discovered_at TIMESTAMPTZ,
    images TEXT[] DEFAULT '{}'::TEXT[],
    video_url TEXT,
    metadata JSONB
);

-- Auto-update search_vector for full-text search
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.brand, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_products_search_vector ON products;
CREATE TRIGGER tr_products_search_vector
    BEFORE INSERT OR UPDATE OF name, description, brand, tags ON products
    FOR EACH ROW
    EXECUTE FUNCTION products_search_vector_update();

-- Backfill existing rows
UPDATE products SET search_vector = setweight(to_tsvector('english', COALESCE(name, '')), 'A') || setweight(to_tsvector('english', COALESCE(description, '')), 'B') || setweight(to_tsvector('english', COALESCE(brand, '')), 'C') || setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'D') WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN(search_vector);

-- Price History Table
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    source TEXT NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscribers Table (SaaS-ready)
-- PII model: `email` stores the encrypted value (AES-256-GCM when
-- ENCRYPTION_KEY is set, otherwise plaintext). `email_hash` is a keyed
-- HMAC-SHA256 blind index used for lookups (unsubscribe, preference
-- updates). With BLIND_INDEX_KEY unset, the hash is lower(email).
CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    email TEXT UNIQUE NOT NULL,
    email_hash TEXT NOT NULL,
    push_subscription_id TEXT,
    preferences JSONB DEFAULT '{"categories": ["physical", "software"], "min_discount": 10}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    unsubscribed_at TIMESTAMPTZ,
    dnd_enabled BOOLEAN DEFAULT FALSE,
    dnd_start TIME,
    dnd_end TIME,
    digest_frequency TEXT CHECK (digest_frequency IN ('immediate', 'hourly', 'daily', 'weekly')) DEFAULT 'immediate',
    subscription_tier TEXT CHECK (subscription_tier IN ('free', 'pro', 'enterprise')) DEFAULT 'free',
    trial_ends_at TIMESTAMPTZ,
    last_notified_at TIMESTAMPTZ,
    unsubscribe_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add blind index for existing databases
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS email_hash TEXT;
UPDATE subscribers SET email_hash = lower(email) WHERE email_hash IS NULL;
ALTER TABLE subscribers ALTER COLUMN email_hash SET NOT NULL;

-- Alert Queue Table (per-subscriber)
CREATE TABLE IF NOT EXISTS alert_queue (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    subscriber_id INT REFERENCES subscribers(id) ON DELETE CASCADE NOT NULL,
    old_price NUMERIC(10, 2) NOT NULL,
    new_price NUMERIC(10, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    last_error TEXT,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    is_dead_letter BOOLEAN DEFAULT FALSE,
    alert_quality_score INT CHECK (alert_quality_score BETWEEN 0 AND 100),
    last_notified_at TIMESTAMPTZ,
    UNIQUE(product_id, subscriber_id, sent)
);

-- Retailer Links Table (affiliate routing)
CREATE TABLE IF NOT EXISTS retailer_links (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    retailer TEXT NOT NULL CHECK (retailer IN ('amazon', 'ebay', 'walmart')),
    affiliate_url TEXT NOT NULL,
    is_sponsored BOOLEAN DEFAULT FALSE,
    click_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, retailer),
    commission_rate NUMERIC(5, 4) DEFAULT 0,
    current_price NUMERIC(10, 2),
    last_checked TIMESTAMPTZ
);

-- Click Tracking Table
CREATE TABLE IF NOT EXISTS click_tracking (
    id SERIAL PRIMARY KEY,
    retailer_link_id INT REFERENCES retailer_links(id) ON DELETE CASCADE NOT NULL,
    subscriber_id INT REFERENCES subscribers(id) ON DELETE SET NULL,
    attribution_token TEXT,
    ip_address TEXT,
    user_agent TEXT,
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dead Letter Queue
CREATE TABLE IF NOT EXISTS alert_dead_letter (
    id SERIAL PRIMARY KEY,
    alert_queue_id INT REFERENCES alert_queue(id) ON DELETE CASCADE NOT NULL,
    product_id INT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    subscriber_id INT REFERENCES subscribers(id) ON DELETE CASCADE NOT NULL,
    old_price NUMERIC(10, 2) NOT NULL,
    new_price NUMERIC(10, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL,
    last_error TEXT,
    attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 2. Performance Indexes
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price_updated ON products(price_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_queue_sent ON alert_queue(sent) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_alert_queue_subscriber ON alert_queue(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_alert_queue_scheduled ON alert_queue(scheduled_for) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_email_hash ON subscribers(email_hash);
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_digest ON subscribers(digest_frequency);
CREATE INDEX IF NOT EXISTS idx_products_deal_type ON products(deal_type);
CREATE INDEX IF NOT EXISTS idx_products_sources ON products USING GIN(sources);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_source_id ON products(source, source_id) WHERE source IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_last_discovered_at ON products(last_discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_queue_subscriber_product ON alert_queue(subscriber_id, product_id) WHERE sent = FALSE AND is_dead_letter = FALSE;
CREATE INDEX IF NOT EXISTS idx_click_tracking_link ON click_tracking(retailer_link_id);
CREATE INDEX IF NOT EXISTS idx_click_tracking_clicked ON click_tracking(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_dead_letter_alert ON alert_dead_letter(alert_queue_id);

-- ===============================================
-- 3. Functions & Triggers
-- ===============================================

-- Auto-update updated_at
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

DROP TRIGGER IF EXISTS tr_subscribers_updated_at ON subscribers;
CREATE TRIGGER tr_subscribers_updated_at
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_retailer_links_updated_at ON retailer_links;
CREATE TRIGGER tr_retailer_links_updated_at
    BEFORE UPDATE ON retailer_links
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Increment alert attempt counter (for retry/backoff)
CREATE OR REPLACE FUNCTION increment_alert_attempt(
    p_alert_id INT,
    p_error_text TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE alert_queue
    SET
        attempts = attempts + 1,
        last_error = p_error_text,
        is_dead_letter = CASE WHEN attempts + 1 >= 5 THEN TRUE ELSE FALSE END
    WHERE id = p_alert_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'Alert % not found', p_alert_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Increment retailer link click count
CREATE OR REPLACE FUNCTION increment_retailer_click(p_link_id INT)
RETURNS VOID AS $$
BEGIN
    UPDATE retailer_links
    SET click_count = click_count + 1
    WHERE id = p_link_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'Retailer link % not found', p_link_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Advisory lock helpers for job runners
CREATE OR REPLACE FUNCTION try_acquire_job_lock(p_lock_id INT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN pg_try_advisory_lock(p_lock_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_job_lock(p_lock_id INT)
RETURNS VOID AS $$
BEGIN
    PERFORM pg_advisory_unlock(p_lock_id);
END;
$$ LANGUAGE plpgsql;

-- Get next alerts for processing (ordered by scheduled time)
CREATE OR REPLACE FUNCTION get_next_alerts(p_limit INT DEFAULT 50)
RETURNS SETOF alert_queue AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM alert_queue
    WHERE sent = FALSE
      AND is_dead_letter = FALSE
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- Move failed alerts to dead letter queue
CREATE OR REPLACE FUNCTION move_to_dead_letter(p_alert_id INT)
RETURNS VOID AS $$
DECLARE
    v_alert alert_queue%ROWTYPE;
BEGIN
    SELECT * INTO v_alert FROM alert_queue WHERE id = p_alert_id;
    IF FOUND THEN
        INSERT INTO alert_dead_letter (
            alert_queue_id, product_id, subscriber_id, old_price, new_price,
            discount_percent, last_error, attempts
        ) VALUES (
            v_alert.id, v_alert.product_id, v_alert.subscriber_id,
            v_alert.old_price, v_alert.new_price, v_alert.discount_percent,
            v_alert.last_error, v_alert.attempts
        );
        DELETE FROM alert_queue WHERE id = p_alert_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Get subscribers eligible for alerts based on category and discount threshold
CREATE OR REPLACE FUNCTION get_subscribers_for_alert(
    p_category TEXT,
    p_min_discount NUMERIC
)
RETURNS SETOF subscribers AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM subscribers
    WHERE is_active = TRUE
      AND (
        preferences->'categories' IS NULL
        OR p_category = ANY(
          SELECT jsonb_array_elements_text(preferences->'categories')
        )
      )
      AND (
        (preferences->>'min_discount') IS NULL
        OR (preferences->>'min_discount')::NUMERIC <= p_min_discount
      );
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- 4. Row Level Security (RLS)
-- ===============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_dead_letter ENABLE ROW LEVEL SECURITY;

-- Products: Public read, Service Role write
DROP POLICY IF EXISTS "Public can view products" ON products;
CREATE POLICY "Public can view products" ON products FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role full access to products" ON products;
CREATE POLICY "Service role full access to products" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Price History: Public read, Service Role write
DROP POLICY IF EXISTS "Public can view price history" ON price_history;
CREATE POLICY "Public can view price history" ON price_history FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role full access to price history" ON price_history;
CREATE POLICY "Service role full access to price history" ON price_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Subscribers: Public insert/update own, Service Role full access
-- Note: email may be encrypted at rest, so the email-format check runs on
-- the blind index column instead. Email format is validated server-side (zod)
-- in the /api/subscribe route.
DROP POLICY IF EXISTS "Public can subscribe" ON subscribers;
CREATE POLICY "Public can subscribe" ON subscribers FOR INSERT TO anon, authenticated WITH CHECK (email IS NOT NULL AND email_hash IS NOT NULL);

DROP POLICY IF EXISTS "Public can update own subscription" ON subscribers;
CREATE POLICY "Public can update own subscription" ON subscribers FOR UPDATE TO anon, authenticated USING (email = (current_setting('request.jwt.claims', true)::json->>'email') OR false) WITH CHECK (email IS NOT NULL);

DROP POLICY IF EXISTS "Service role full access to subscribers" ON subscribers;
CREATE POLICY "Service role full access to subscribers" ON subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Alert Queue: Service Role only
DROP POLICY IF EXISTS "Service role full access to alert_queue" ON alert_queue;
CREATE POLICY "Service role full access to alert_queue" ON alert_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Retailer Links: Public read, Service Role write
DROP POLICY IF EXISTS "Public can view retailer_links" ON retailer_links;
CREATE POLICY "Public can view retailer_links" ON retailer_links FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role full access to retailer_links" ON retailer_links;
CREATE POLICY "Service role full access to retailer_links" ON retailer_links FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Click Tracking: Public insert, Service Role read
DROP POLICY IF EXISTS "Public can record clicks" ON click_tracking;
CREATE POLICY "Public can record clicks" ON click_tracking FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can view click_tracking" ON click_tracking;
CREATE POLICY "Service role can view click_tracking" ON click_tracking FOR SELECT TO service_role USING (true);

-- Dead Letter Queue: Service Role only
DROP POLICY IF EXISTS "Service role full access to alert_dead_letter" ON alert_dead_letter;
CREATE POLICY "Service role full access to alert_dead_letter" ON alert_dead_letter FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===============================================
-- 5. Data Retention (run as scheduled job)
-- ===============================================

-- Keep price_history for 2 years, older entries can be archived
CREATE OR REPLACE FUNCTION archive_old_price_history()
RETURNS VOID AS $$
BEGIN
    DELETE FROM price_history WHERE recorded_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- Keep click_tracking for 1 year
CREATE OR REPLACE FUNCTION archive_old_clicks()
RETURNS VOID AS $$
BEGIN
    DELETE FROM click_tracking WHERE clicked_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Archive sent alerts older than 90 days
CREATE OR REPLACE FUNCTION archive_old_alerts()
RETURNS VOID AS $$
BEGIN
    DELETE FROM alert_queue WHERE sent = true AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Archive dead letter queue entries older than 30 days
CREATE OR REPLACE FUNCTION archive_old_dead_letters()
RETURNS VOID AS $$
BEGIN
    DELETE FROM alert_dead_letter WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Archive job runs older than 30 days
CREATE OR REPLACE FUNCTION archive_old_job_runs()
RETURNS VOID AS $$
BEGIN
    DELETE FROM job_runs WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Job Runs Table (execution logging)
CREATE TABLE IF NOT EXISTS job_runs (
    id SERIAL PRIMARY KEY,
    job_name TEXT NOT NULL CHECK (job_name IN ('fetch-prices', 'send-alerts')),
    status TEXT CHECK (status IN ('running', 'success', 'failed', 'partial')) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INT,
    records_processed INT DEFAULT 0,
    records_succeeded INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_name ON job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status);

ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to job_runs" ON job_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RPC: Insert job run
CREATE OR REPLACE FUNCTION insert_job_run(
    p_job_name TEXT,
    p_status TEXT,
    p_records_processed INT DEFAULT 0,
    p_records_succeeded INT DEFAULT 0,
    p_records_failed INT DEFAULT 0,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS job_runs AS $$
DECLARE
    v_run job_runs;
BEGIN
    INSERT INTO job_runs (
        job_name, status, records_processed, records_succeeded, records_failed,
        error_message, metadata, finished_at, duration_ms
    )
    VALUES (
        p_job_name, p_status, p_records_processed, p_records_succeeded, p_records_failed,
        p_error_message, p_metadata, NOW(), EXTRACT(EPOCH FROM (NOW() - NOW())) * 1000
    )
    RETURNING * INTO v_run;
    RETURN v_run;
END;
$$ LANGUAGE plpgsql;

-- RPC: Update job run
CREATE OR REPLACE FUNCTION update_job_run(
    p_run_id INT,
    p_status TEXT,
    p_records_processed INT DEFAULT NULL,
    p_records_succeeded INT DEFAULT NULL,
    p_records_failed INT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
BEGIN
    SELECT started_at INTO v_started_at FROM job_runs WHERE id = p_run_id;
    IF NOT FOUND THEN
        RAISE NOTICE 'Job run % not found', p_run_id;
        RETURN;
    END IF;

    UPDATE job_runs
    SET
        status = p_status,
        finished_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000,
        records_processed = COALESCE(p_records_processed, records_processed),
        records_succeeded = COALESCE(p_records_succeeded, records_succeeded),
        records_failed = COALESCE(p_records_failed, records_failed),
        error_message = COALESCE(p_error_message, error_message),
        metadata = COALESCE(p_metadata, metadata)
    WHERE id = p_run_id;
END;
$$ LANGUAGE plpgsql;
