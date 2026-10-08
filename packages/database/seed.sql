-- ThinkaBell Starter Seed Data
--
-- DEVELOPMENT STARTER DATA ONLY - not production content.
-- Products, prices, and ASINs/ePIDs below are placeholders for local testing.
-- Retailer URLs are intentionally stored WITHOUT affiliate tags: static SQL
-- cannot read environment variables, and hardcoding a partner tag here would
-- misattribute commissions. The application generates tagged links dynamically
-- per request (apps/web/app/go/amazon/[asin]/route.ts and the shared
-- amazonAffiliateLinkGenerator), so stored URLs act as plain fallback links.
-- Replace this data with real curated products (docs/AMAZON_LIST_CURATION.md)
-- before any public launch. Seeding requires SUPABASE_SERVICE_ROLE_KEY because
-- the products table grants anon read-only access under Row Level Security.

-- Clear existing data if re-seeding
TRUNCATE TABLE click_tracking CASCADE;
TRUNCATE TABLE alert_dead_letter CASCADE;
TRUNCATE TABLE alert_queue CASCADE;
TRUNCATE TABLE retailer_links CASCADE;
TRUNCATE TABLE price_history CASCADE;
TRUNCATE TABLE subscribers CASCADE;
TRUNCATE TABLE products CASCADE;

-- 1. Insert Initial Products
INSERT INTO products (id, name, slug, category, brand, amazon_asin, ebay_epid, walmart_sku, affiliate_links, current_price, previous_price, price_updated_at, image_url, description, tags, is_active, user_id)
VALUES
(
    1,
    'Apple MacBook Pro 14" M3 Pro (18GB/512GB)',
    'apple-macbook-pro-14-m3-pro',
    'physical',
    'Apple',
    'B0CM5N4G3T',
    'EPID-238491',
    NULL,
    '{"amazon": "https://amazon.com/dp/B0CM5N4G3T", "ebay": "https://ebay.com/itm/EPID-238491"}',
    1749.00,
    1999.00,
    NOW(),
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
    'The 14-inch MacBook Pro with M3 Pro chip delivers extreme performance for demanding pro workflows.',
    ARRAY['laptop', 'apple', 'hardware', 'pro'],
    TRUE,
    NULL
),
(
    2,
    'Sony WH-1000XM5 Wireless Noise-Canceling Headphones',
    'sony-wh-1000xm5-wireless-headphones',
    'physical',
    'Sony',
    'B09XS7JWHH',
    'EPID-849201',
    NULL,
    '{"amazon": "https://amazon.com/dp/B09XS7JWHH", "ebay": "https://ebay.com/itm/EPID-849201"}',
    328.00,
    399.99,
    NOW(),
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    'Industry-leading noise cancellation with two processors and 8 microphones for unprecedented call clarity.',
    ARRAY['audio', 'headphones', 'sony', 'anc'],
    TRUE,
    NULL
),
(
    3,
    'NordVPN 2-Year Ultimate Security Suite',
    'nordvpn-2-year-ultimate-plan',
    'software',
    'Nord Security',
    NULL,
    NULL,
    NULL,
    '{"direct": "https://nordvpn.com/order/"}',
    83.76,
    286.80,
    NOW(),
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
    'Next-generation encrypted VPN, Threat Protection anti-malware, and 1TB cloud storage.',
    ARRAY['vpn', 'security', 'software', 'privacy'],
    TRUE,
    NULL
),
(
    4,
    'CleanMyMac X Multi-Device License',
    'cleanmymac-x-multi-device',
    'software',
    'MacPaw',
    NULL,
    NULL,
    NULL,
    '{"direct": "https://macpaw.com/cleanmymac"}',
    59.95,
    89.95,
    NOW(),
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    'All-in-one optimizer and malware removal suite built exclusively for macOS.',
    ARRAY['mac', 'utility', 'software', 'optimization'],
    TRUE,
    NULL
),
(
    5,
    'Logitech MX Master 3S Wireless Performance Mouse',
    'logitech-mx-master-3s-mouse',
    'physical',
    'Logitech',
    'B09HM94VDS',
    'EPID-472910',
    NULL,
    '{"amazon": "https://amazon.com/dp/B09HM94VDS"}',
    89.99,
    99.99,
    NOW(),
    'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
    'Quiet clicks, 8K DPI track-on-glass sensor, and ergonomic comfort for developers and designers.',
    ARRAY['mouse', 'logitech', 'ergonomic', 'gadget'],
    TRUE,
    NULL
),
(
    6,
    'Raycast Pro Annual Subscription',
    'raycast-pro-annual',
    'software',
    'Raycast',
    NULL,
    NULL,
    NULL,
    '{"direct": "https://raycast.com/pro"}',
    96.00,
    120.00,
    NOW(),
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    'Supercharge productivity with Raycast AI, custom themes, clipboard sync, and window management.',
    ARRAY['productivity', 'developer', 'ai', 'software'],
    TRUE,
    NULL
);

-- Adjust sequence to avoid primary key conflict
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- 2. Insert Price History Points (for chart visualizations)
INSERT INTO price_history (product_id, price, source, recorded_at)
VALUES
(1, 1999.00, 'amazon', NOW() - INTERVAL '30 days'),
(1, 1949.00, 'amazon', NOW() - INTERVAL '20 days'),
(1, 1899.00, 'amazon', NOW() - INTERVAL '10 days'),
(1, 1749.00, 'amazon', NOW()),

(2, 399.99, 'amazon', NOW() - INTERVAL '40 days'),
(2, 379.99, 'amazon', NOW() - INTERVAL '25 days'),
(2, 348.00, 'amazon', NOW() - INTERVAL '7 days'),
(2, 328.00, 'amazon', NOW()),

(3, 286.80, 'direct', NOW() - INTERVAL '30 days'),
(3, 119.00, 'direct', NOW() - INTERVAL '14 days'),
(3, 83.76, 'direct', NOW()),

(4, 89.95, 'direct', NOW() - INTERVAL '30 days'),
(4, 74.95, 'direct', NOW() - INTERVAL '15 days'),
(4, 59.95, 'direct', NOW()),

(5, 99.99, 'amazon', NOW() - INTERVAL '30 days'),
(5, 89.99, 'amazon', NOW()),

(6, 120.00, 'direct', NOW() - INTERVAL '30 days'),
(6, 96.00, 'direct', NOW());

-- 3. Insert Starter Subscribers
-- email_hash uses the dev fallback (lower(email)); production rows are
-- keyed HMAC-SHA256 blind indexes computed by the application.
INSERT INTO subscribers (email, email_hash, push_subscription_id, preferences, is_active, dnd_enabled, dnd_start, dnd_end, digest_frequency, subscription_tier, trial_ends_at, last_notified_at, user_id)
VALUES
('demo@thinkabell.click', 'demo@thinkabell.click', 'push-sub-demo-123', '{"categories": ["physical", "software"], "min_discount": 10}', TRUE, FALSE, NULL, NULL, 'immediate', 'free', NULL, NOW(), NULL),
('deals-hunter@thinkabell.click', 'deals-hunter@thinkabell.click', NULL, '{"categories": ["software"], "min_discount": 20}', TRUE, FALSE, NULL, NULL, 'daily', 'free', NULL, NOW() - INTERVAL '2 days', NULL);

-- 4. Insert Retailer Links
INSERT INTO retailer_links (product_id, retailer, affiliate_url, is_sponsored, click_count)
VALUES
(1, 'amazon', 'https://amazon.com/dp/B0CM5N4G3T', FALSE, 42),
(1, 'ebay', 'https://ebay.com/itm/EPID-238491', TRUE, 18),
(2, 'amazon', 'https://amazon.com/dp/B09XS7JWHH', FALSE, 35),
(2, 'ebay', 'https://ebay.com/itm/EPID-849201', TRUE, 12),
(5, 'amazon', 'https://amazon.com/dp/B09HM94VDS', FALSE, 28),
(5, 'ebay', 'https://ebay.com/itm/EPID-472910', TRUE, 9);

-- 5. Insert Click Tracking Samples
INSERT INTO click_tracking (retailer_link_id, subscriber_id, ip_address, user_agent, clicked_at)
VALUES
(1, 1, '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '2 hours'),
(2, 1, '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', NOW() - INTERVAL '1 hour'),
(3, 2, '10.0.0.50', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', NOW() - INTERVAL '30 minutes'),
(5, 1, '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '15 minutes');

-- 6. Insert Initial Alert Queue Samples (per-subscriber)
INSERT INTO alert_queue (product_id, subscriber_id, old_price, new_price, discount_percent, created_at, sent, attempts, is_dead_letter)
VALUES
(1, 1, 1999.00, 1749.00, 12.51, NOW() - INTERVAL '2 hours', TRUE, 0, FALSE),
(1, 2, 1999.00, 1749.00, 12.51, NOW() - INTERVAL '2 hours', TRUE, 0, FALSE),
(2, 1, 399.99, 328.00, 18.00, NOW() - INTERVAL '1 hour', TRUE, 0, FALSE),
(3, 1, 286.80, 83.76, 70.79, NOW() - INTERVAL '15 minutes', FALSE, 0, FALSE),
(3, 2, 286.80, 83.76, 70.79, NOW() - INTERVAL '15 minutes', FALSE, 0, FALSE);

-- 7. Insert Dead Letter Queue Samples
INSERT INTO alert_dead_letter (alert_queue_id, product_id, subscriber_id, old_price, new_price, discount_percent, last_error, attempts)
VALUES
(999, 1, 1, 1999.00, 1749.00, 12.51, 'Push notification failed: invalid subscription', 5);
