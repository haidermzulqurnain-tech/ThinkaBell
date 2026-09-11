-- ThinkaBell Starter Seed Data

-- Clear existing data if re-seeding
TRUNCATE TABLE alert_queue CASCADE;
TRUNCATE TABLE price_history CASCADE;
TRUNCATE TABLE subscribers CASCADE;
TRUNCATE TABLE products CASCADE;

-- 1. Insert Initial Products
INSERT INTO products (id, name, slug, category, brand, amazon_asin, ebay_epid, affiliate_links, current_price, previous_price, price_updated_at, image_url, description, tags)
VALUES
(
    1,
    'Apple MacBook Pro 14" M3 Pro (18GB/512GB)',
    'apple-macbook-pro-14-m3-pro',
    'physical',
    'Apple',
    'B0CM5N4G3T',
    'EPID-238491',
    '{"amazon": "https://amazon.com/dp/B0CM5N4G3T?tag=thinkabell-20", "ebay": "https://ebay.com/itm/EPID-238491?campid=thinkabell"}',
    1749.00,
    1999.00,
    NOW(),
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
    'The 14-inch MacBook Pro with M3 Pro chip delivers extreme performance for demanding pro workflows.',
    ARRAY['laptop', 'apple', 'hardware', 'pro']
),
(
    2,
    'Sony WH-1000XM5 Wireless Noise-Canceling Headphones',
    'sony-wh-1000xm5-wireless-headphones',
    'physical',
    'Sony',
    'B09XS7JWHH',
    'EPID-849201',
    '{"amazon": "https://amazon.com/dp/B09XS7JWHH?tag=thinkabell-20", "ebay": "https://ebay.com/itm/EPID-849201?campid=thinkabell"}',
    328.00,
    399.99,
    NOW(),
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    'Industry-leading noise cancellation with two processors and 8 microphones for unprecedented call clarity.',
    ARRAY['audio', 'headphones', 'sony', 'anc']
),
(
    3,
    'NordVPN 2-Year Ultimate Security Suite',
    'nordvpn-2-year-ultimate-plan',
    'software',
    'Nord Security',
    NULL,
    NULL,
    '{"direct": "https://nordvpn.com/order/?affid=thinkabell", "impact": "https://nordvpn.sjv.io/c/thinkabell"}',
    83.76,
    286.80,
    NOW(),
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
    'Next-generation encrypted VPN, Threat Protection anti-malware, and 1TB cloud storage.',
    ARRAY['vpn', 'security', 'software', 'privacy']
),
(
    4,
    'CleanMyMac X Multi-Device License',
    'cleanmymac-x-multi-device',
    'software',
    'MacPaw',
    NULL,
    NULL,
    '{"direct": "https://macpaw.com/cleanmymac?aff=thinkabell"}',
    59.95,
    89.95,
    NOW(),
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    'All-in-one optimizer and malware removal suite built exclusively for macOS.',
    ARRAY['mac', 'utility', 'software', 'optimization']
),
(
    5,
    'Logitech MX Master 3S Wireless Performance Mouse',
    'logitech-mx-master-3s-mouse',
    'physical',
    'Logitech',
    'B09HM94VDS',
    'EPID-472910',
    '{"amazon": "https://amazon.com/dp/B09HM94VDS?tag=thinkabell-20"}',
    89.99,
    99.99,
    NOW(),
    'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
    'Quiet clicks, 8K DPI track-on-glass sensor, and ergonomic comfort for developers and designers.',
    ARRAY['mouse', 'logitech', 'ergonomic', 'gadget']
),
(
    6,
    'Raycast Pro Annual Subscription',
    'raycast-pro-annual',
    'software',
    'Raycast',
    NULL,
    NULL,
    '{"direct": "https://raycast.com/pro?ref=thinkabell"}',
    96.00,
    120.00,
    NOW(),
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    'Supercharge productivity with Raycast AI, custom themes, clipboard sync, and window management.',
    ARRAY['productivity', 'developer', 'ai', 'software']
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
INSERT INTO subscribers (email, push_subscription_id, preferences)
VALUES
('demo@thinkabell.click', 'push-sub-demo-123', '{"categories": ["physical", "software"], "min_discount": 10}'),
('deals-hunter@thinkabell.click', NULL, '{"categories": ["software"], "min_discount": 20}');

-- 4. Insert Initial Alert Queue Samples
INSERT INTO alert_queue (product_id, old_price, new_price, discount_percent, created_at, sent)
VALUES
(1, 1999.00, 1749.00, 12.51, NOW() - INTERVAL '2 hours', true),
(2, 399.99, 328.00, 18.00, NOW() - INTERVAL '1 hour', true),
(3, 286.80, 83.76, 70.79, NOW() - INTERVAL '15 minutes', false);
