/**
 * Seed 50 Manually Curated Products for ThinkaBell Launch
 *
 * Populates Supabase with 50 physical hardware and software deals
 * complete with ASINs, ePIDs, affiliate links, and historical price points.
 *
 * IMPORTANT: the bundled catalog is placeholder data — product names are
 * real, but ASINs, ePIDs, and prices are not verified against live
 * listings. Replace with genuinely curated entries (see
 * docs/AMAZON_LIST_CURATION.md) before relying on deal pages for
 * revenue. Affiliate links are generated from environment configuration
 * (AMAZON_PARTNER_TAG, EBAY_AFFILIATE_CAMPAIGN_ID); when a tag is not
 * configured the seeder fails closed to a plain product URL rather than
 * writing a hardcoded tag.
 *
 * Writes use the Supabase service role client: products RLS grants anon
 * read-only access, so seeding requires SUPABASE_SERVICE_ROLE_KEY.
 */

import { getSupabaseServiceClient } from "../packages/database/src/client";
import {
  AmazonAffiliateLinkError,
  buildAmazonProductUrl,
  generateAmazonAffiliateLink,
  isValidAsin,
} from "../packages/shared/src/api/amazonAffiliateLinkGenerator";
import { env } from "../packages/config/src/env";

interface ProductSeed {
  name: string;
  slug: string;
  category: "physical" | "software";
  brand: string;
  amazon_asin?: string;
  ebay_epid?: string;
  current_price: number;
  previous_price: number;
  image_url: string;
  description: string;
  tags: string[];
}

const CATALOG: ProductSeed[] = [
  {
    name: 'Apple MacBook Pro 14" M3 Pro',
    slug: "apple-macbook-pro-14-m3-pro",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0CM5N4G3T",
    current_price: 1749.0,
    previous_price: 1999.0,
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
    description: "Premium Apple MacBook Pro 14 with M3 Pro chip, tracked for genuine price discounts and verified deals.",
    tags: ["laptop", "apple", "hardware"],
  },
  {
    name: 'Apple MacBook Air 15" M3 (16GB)',
    slug: "apple-macbook-air-15-m3-16gb",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0BSHVQ2HW",
    current_price: 1099.0,
    previous_price: 1299.0,
    image_url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80",
    description: "Thin and light Apple MacBook Air 15 with M3 chip, perfect for productivity on the go.",
    tags: ["laptop", "apple", "ultrabook"],
  },
  {
    name: 'Apple iPad Pro 11" M4 OLED',
    slug: "apple-ipad-pro-11-m4-oled",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0D3F4G5H6",
    current_price: 899.0,
    previous_price: 999.0,
    image_url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80",
    description: "Powerful Apple iPad Pro 11 with M4 chip and stunning OLED display.",
    tags: ["tablet", "apple", "oled"],
  },
  {
    name: "Sony WH-1000XM5 Wireless ANC Headphones",
    slug: "sony-wh-1000xm5-wireless-anc-headphones",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B09XS7JWHH",
    current_price: 328.0,
    previous_price: 399.99,
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    description: "Industry-leading noise canceling wireless headphones from Sony with premium sound quality.",
    tags: ["audio", "headphones", "anc"],
  },
  {
    name: "Sony WF-1000XM5 Noise Canceling Earbuds",
    slug: "sony-wf-1000xm5-noise-canceling-earbuds",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B0C1D2E3F4",
    current_price: 248.0,
    previous_price: 299.99,
    image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
    description: "Compact true wireless earbuds with industry-leading noise cancellation from Sony.",
    tags: ["audio", "earbuds", "anc"],
  },
  {
    name: "Logitech MX Master 3S Wireless Mouse",
    slug: "logitech-mx-master-3s-wireless-mouse",
    category: "physical",
    brand: "Logitech",
    amazon_asin: "B0BNH2J3K4",
    current_price: 89.99,
    previous_price: 99.99,
    image_url: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80",
    description: "Premium wireless mouse with ultra-fast scrolling and ergonomic design from Logitech.",
    tags: ["mouse", "logitech", "ergonomic"],
  },
  {
    name: "Logitech MX Keys S Wireless Keyboard",
    slug: "logitech-mx-keys-s-wireless-keyboard",
    category: "physical",
    brand: "Logitech",
    amazon_asin: "B0B5C6D7E8",
    current_price: 99.99,
    previous_price: 119.99,
    image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
    description: "Advanced wireless keyboard with smart illumination and ergonomic design from Logitech.",
    tags: ["keyboard", "logitech", "productivity"],
  },
  {
    name: "Keychron Q1 Pro Wireless Mechanical Keyboard",
    slug: "keychron-q1-pro-wireless-mechanical-keyboard",
    category: "physical",
    brand: "Keychron",
    amazon_asin: "B0F8G9H0J1",
    current_price: 169.0,
    previous_price: 199.0,
    image_url: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80",
    description: "Premium wireless mechanical keyboard with QMK/VIA support and aluminum frame.",
    tags: ["keyboard", "mechanical", "custom"],
  },
  {
    name: "Anker Prime 20,000mAh Power Bank (200W)",
    slug: "anker-prime-20000mah-power-bank-200w",
    category: "physical",
    brand: "Anker",
    amazon_asin: "B0A2B3C4D5",
    current_price: 99.99,
    previous_price: 129.99,
    image_url: "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?auto=format&fit=crop&w=800&q=80",
    description: "High-capacity power bank with 200W output for charging laptops, tablets, and phones.",
    tags: ["charging", "anker", "powerbank"],
  },
  {
    name: "Anker MagGo 3-in-1 Wireless Charging Station",
    slug: "anker-maggo-3-in-1-wireless-charging-station",
    category: "physical",
    brand: "Anker",
    amazon_asin: "B0E6F7G8H9",
    current_price: 82.5,
    previous_price: 109.99,
    image_url: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80",
    description: "Convenient 3-in-1 wireless charger for iPhone, Apple Watch, and AirPods.",
    tags: ["charging", "wireless", "magsafe"],
  },
  {
    name: "Bose QuietComfort Ultra Headphones",
    slug: "bose-quietcomfort-ultra-headphones",
    category: "physical",
    brand: "Bose",
    amazon_asin: "B0F9G0H1J2",
    current_price: 349.0,
    previous_price: 429.0,
    image_url: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80",
    description: "Premium noise cancelling headphones with immersive audio and comfortable fit.",
    tags: ["audio", "bose", "anc"],
  },
  {
    name: "LG UltraGear 27\" OLED 240Hz Gaming Monitor",
    slug: "lg-ultragear-27-oled-240hz-gaming-monitor",
    category: "physical",
    brand: "LG",
    amazon_asin: "B0K3L4M5N6",
    current_price: 649.99,
    previous_price: 899.99,
    image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
    description: "High-performance gaming monitor with OLED panel and 240Hz refresh rate.",
    tags: ["monitor", "gaming", "oled"],
  },
  {
    name: "Dell UltraSharp 32\" 4K USB-C Hub Monitor",
    slug: "dell-ultrasharp-32-4k-usb-c-hub-monitor",
    category: "physical",
    brand: "Dell",
    amazon_asin: "B0P7Q8R9S0",
    current_price: 699.0,
    previous_price: 859.99,
    image_url: "https://images.unsplash.com/photo-1547119957-637f8679db1e?auto=format&fit=crop&w=800&q=80",
    description: "Professional 4K monitor with USB-C hub and built-in network connectivity.",
    tags: ["monitor", "dell", "4k"],
  },
  {
    name: "DJI Osmo Pocket 3 Creator Combo",
    slug: "dji-osmo-pocket-3-creator-combo",
    category: "physical",
    brand: "DJI",
    amazon_asin: "B0T1U2V3W4",
    current_price: 599.0,
    previous_price: 669.0,
    image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
    description: "Compact 3-axis gimbal camera with 1-inch CMOS sensor for creators.",
    tags: ["camera", "video", "dji"],
  },
  {
    name: "Samsung Galaxy Tab S9 Ultra (512GB)",
    slug: "samsung-galaxy-tab-s9-ultra-512gb",
    category: "physical",
    brand: "Samsung",
    amazon_asin: "B0X5Y6Z7A8",
    current_price: 949.99,
    previous_price: 1199.99,
    image_url: "https://images.unsplash.com/photo-1561154464-82e9adf32764?auto=format&fit=crop&w=800&q=80",
    description: "Premium Android tablet with large AMOLED display and S Pen included.",
    tags: ["tablet", "samsung", "android"],
  },
  {
    name: "Apple AirPods Pro 2nd Generation",
    slug: "apple-airpods-pro-2nd-generation",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0BDHX7BZQ",
    current_price: 189.99,
    previous_price: 249.0,
    image_url: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=80",
    description: "Active noise cancellation wireless earbuds with adaptive transparency and personalized spatial audio.",
    tags: ["audio", "earbuds", "anc"],
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    slug: "samsung-galaxy-s24-ultra",
    category: "physical",
    brand: "Samsung",
    amazon_asin: "B0CX9K2M4P",
    current_price: 999.99,
    previous_price: 1299.99,
    image_url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80",
    description: "Premium Android smartphone with S Pen and advanced AI features.",
    tags: ["phone", "samsung", "android"],
  },
  {
    name: "Dell XPS 16 Laptop",
    slug: "dell-xps-16-laptop",
    category: "physical",
    brand: "Dell",
    amazon_asin: "B0D6E7F8G9",
    current_price: 1299.0,
    previous_price: 1499.0,
    image_url: "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?auto=format&fit=crop&w=800&q=80",
    description: "Premium 16-inch laptop with stunning OLED display and powerful Intel Core Ultra processor.",
    tags: ["laptop", "dell", "ultrabook"],
  },
  {
    name: "Sony PlayStation 5 Slim Console",
    slug: "sony-playstation-5-slim-console",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B0H9I0J1K2",
    current_price: 449.99,
    previous_price: 499.99,
    image_url: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80",
    description: "Next-gen gaming console with ultra-high speed SSD and ray tracing support.",
    tags: ["gaming", "console", "playstation"],
  },
  {
    name: "Nintendo Switch OLED Model",
    slug: "nintendo-switch-oled-model",
    category: "physical",
    brand: "Nintendo",
    amazon_asin: "B0L3M4N5O6",
    current_price: 299.99,
    previous_price: 349.99,
    image_url: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&w=800&q=80",
    description: "Hybrid gaming console with vibrant 7-inch OLED screen and enhanced audio.",
    tags: ["gaming", "console", "nintendo"],
  },
  {
    name: "Anker 737 Power Bank (24,000mAh)",
    slug: "anker-737-power-bank-24000mah",
    category: "physical",
    brand: "Anker",
    amazon_asin: "B0F5G6H7J8",
    current_price: 109.99,
    previous_price: 139.99,
    image_url: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=800&q=80",
    description: "Massive capacity power bank with 140W output for charging multiple devices simultaneously.",
    tags: ["charging", "anker", "powerbank"],
  },
  {
    name: "Bose SoundLink Max Portable Speaker",
    slug: "bose-soundlink-max-portable-speaker",
    category: "physical",
    brand: "Bose",
    amazon_asin: "B0C9D0E1F2",
    current_price: 349.0,
    previous_price: 399.0,
    image_url: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80",
    description: "Powerful portable Bluetooth speaker with deep bass and 20-hour battery life.",
    tags: ["audio", "speaker", "portable"],
  },
  {
    name: "Logitech G Pro X Superlight 2 Mouse",
    slug: "logitech-g-pro-x-superlight-2-mouse",
    category: "physical",
    brand: "Logitech",
    amazon_asin: "B0G2H3I4J5",
    current_price: 149.99,
    previous_price: 159.99,
    image_url: "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=800&q=80",
    description: "Ultra-lightweight wireless gaming mouse with HERO 2 sensor and 95-hour battery.",
    tags: ["mouse", "logitech", "gaming"],
  },
  {
    name: "Samsung 49\" Odyssey OLED G9 Monitor",
    slug: "samsung-49-odyssey-oled-g9-monitor",
    category: "physical",
    brand: "Samsung",
    amazon_asin: "B0K6L7M8N9",
    current_price: 1299.99,
    previous_price: 1799.99,
    image_url: "https://images.unsplash.com/photo-1585792180666-f7347f490ea2?auto=format&fit=crop&w=800&q=80",
    description: "Immersive dual-4K curved gaming monitor with OLED panel and 240Hz refresh rate.",
    tags: ["monitor", "gaming", "oled"],
  },
  {
    name: "Apple Watch Ultra 2",
    slug: "apple-watch-ultra-2",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0CCHMQBQH",
    current_price: 699.0,
    previous_price: 799.0,
    image_url: "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&w=800&q=80",
    description: "Most rugged and capable Apple Watch with precision GPS and action button.",
    tags: ["wearable", "apple", "smartwatch"],
  },
  {
    name: "Sony Alpha 7 IV Mirrorless Camera",
    slug: "sony-alpha-7-iv-mirrorless-camera",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B0BJGK7BZP",
    current_price: 2198.0,
    previous_price: 2498.0,
    image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
    description: "Full-frame mirrorless camera with 33MP sensor and advanced autofocus system.",
    tags: ["camera", "sony", "photography"],
  },
  {
    name: "Keychron K8 Pro Wireless Mechanical Keyboard",
    slug: "keychron-k8-pro-wireless-mechanical-keyboard",
    category: "physical",
    brand: "Keychron",
    amazon_asin: "B0P1Q2R3S4",
    current_price: 109.0,
    previous_price: 129.0,
    image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
    description: "Wireless mechanical keyboard with Gateron switches and macOS compatibility.",
    tags: ["keyboard", "mechanical", "custom"],
  },
  {
    name: "DJI Mini 4 Pro Drone",
    slug: "dji-mini-4-pro-drone",
    category: "physical",
    brand: "DJI",
    amazon_asin: "B0C5D6E7F8",
    current_price: 759.0,
    previous_price: 859.0,
    image_url: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=800&q=80",
    description: "Compact drone with 4K/60fps HDR video and omnidirectional obstacle sensing.",
    tags: ["camera", "drone", "dji"],
  },
  {
    name: "Apple HomePod 2nd Generation",
    slug: "apple-homepod-2nd-generation",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0BSHZ3BZQ",
    current_price: 249.0,
    previous_price: 299.0,
    image_url: "https://images.unsplash.com/photo-1589492477829-5e65395b66cc?auto=format&fit=crop&w=800&q=80",
    description: "Intelligent speaker with room-filling sound and Siri intelligence.",
    tags: ["audio", "speaker", "smart-home"],
  },
  {
    name: "LG C3 55\" OLED 4K Smart TV",
    slug: "lg-c3-55-oled-4k-smart-tv",
    category: "physical",
    brand: "LG",
    amazon_asin: "B0B8C9D0E1",
    current_price: 1096.99,
    previous_price: 1499.99,
    image_url: "https://images.unsplash.com/photo-1593359677879-a4d92f7d9d0e?auto=format&fit=crop&w=800&q=80",
    description: "Stunning OLED TV with self-lit pixels, perfect for movies and gaming.",
    tags: ["tv", "lg", "oled"],
  },
  {
    name: "Sony A80K 65\" OLED 4K Google TV",
    slug: "sony-a80k-65-oled-4k-google-tv",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B0B8C9D0E2",
    current_price: 1398.0,
    previous_price: 1798.0,
    image_url: "https://images.unsplash.com/photo-1593784991095-a995069ad35a?auto=format&fit=crop&w=800&q=80",
    description: "Cognitive intelligence TV with stunning OLED picture and Google TV smart platform.",
    tags: ["tv", "sony", "oled"],
  },
  {
    name: "Razer BlackWidow V4 Pro Keyboard",
    slug: "razer-blackwidow-v4-pro-keyboard",
    category: "physical",
    brand: "Razer",
    amazon_asin: "B0F2G3H4J5",
    current_price: 229.99,
    previous_price: 249.99,
    image_url: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80",
    description: "Premium gaming keyboard with Razer Green switches and command dial.",
    tags: ["keyboard", "razer", "gaming"],
  },
  {
    name: "Apple AirTag 4-Pack",
    slug: "apple-airtag-4-pack",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0D3F4G5H7",
    current_price: 79.99,
    previous_price: 99.99,
    image_url: "https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?auto=format&fit=crop&w=800&q=80",
    description: "Keep track of your items with precision finding and the Find My network.",
    tags: ["accessories", "apple", "tracking"],
  },
  {
    name: "Bose QuietComfort Earbuds II",
    slug: "bose-quietcomfort-earbuds-ii",
    category: "physical",
    brand: "Bose",
    amazon_asin: "B0B6C7D8E9",
    current_price: 199.0,
    previous_price: 279.0,
    image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
    description: "World-class noise cancelling earbuds with personalized sound profile.",
    tags: ["audio", "earbuds", "anc"],
  },
  {
    name: "Samsung Galaxy Watch 6 Classic",
    slug: "samsung-galaxy-watch-6-classic",
    category: "physical",
    brand: "Samsung",
    amazon_asin: "B0C9D0E1F3",
    current_price: 299.99,
    previous_price: 399.99,
    image_url: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=800&q=80",
    description: "Premium smartwatch with rotating bezel and advanced health monitoring.",
    tags: ["wearable", "samsung", "smartwatch"],
  },
  {
    name: "Logitech C920x HD Pro Webcam",
    slug: "logitech-c920x-hd-pro-webcam",
    category: "physical",
    brand: "Logitech",
    amazon_asin: "B0B4C5D6E7",
    current_price: 69.99,
    previous_price: 79.99,
    image_url: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=800&q=80",
    description: "Full HD 1080p webcam with stereo audio and adjustable field of view.",
    tags: ["webcam", "logitech", "streaming"],
  },
  {
    name: "Razer DeathAdder V3 Pro Mouse",
    slug: "razer-deathadder-v3-pro-mouse",
    category: "physical",
    brand: "Razer",
    amazon_asin: "B0B7C8D9E0",
    current_price: 89.99,
    previous_price: 149.99,
    image_url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
    description: "Ultra-lightweight ergonomic gaming mouse with Focus Pro 30K optical sensor.",
    tags: ["mouse", "razer", "gaming"],
  },
  {
    name: "DJI Osmo Action 4 Adventure Combo",
    slug: "dji-osmo-action-4-adventure-combo",
    category: "physical",
    brand: "DJI",
    amazon_asin: "B0C6F7G8H0",
    current_price: 349.0,
    previous_price: 429.0,
    image_url: "https://images.unsplash.com/photo-1564466809058-bf4114d55352?auto=format&fit=crop&w=800&q=80",
    description: "Waterproof action camera with 4K/120fps video and RockSteady 3.0 stabilization.",
    tags: ["camera", "action", "dji"],
  },
  {
    name: "Sony ZV-E10 II Mirrorless Vlog Camera",
    slug: "sony-zv-e10-ii-mirrorless-vlog-camera",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B0D7E8F9G0",
    current_price: 698.0,
    previous_price: 798.0,
    image_url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
    description: "Compact vlog camera with 26MP sensor and improved autofocus for content creators.",
    tags: ["camera", "sony", "vlogging"],
  },
  {
    name: "Anker USB-C 8-in-1 Hub",
    slug: "anker-usb-c-8-in-1-hub",
    category: "physical",
    brand: "Anker",
    amazon_asin: "B0CZ7M4O6R",
    current_price: 49.99,
    previous_price: 59.99,
    image_url: "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=800&q=80",
    description: "Compact USB-C hub with 8 ports including 4K HDMI, SD card, and 100W power delivery.",
    tags: ["accessories", "anker", "usb-c"],
  },
  {
    name: "Apple Magic Keyboard with Touch ID",
    slug: "apple-magic-keyboard-with-touch-id",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0B8C9D0E3",
    current_price: 149.0,
    previous_price: 179.0,
    image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
    description: "Wireless keyboard with Touch ID for secure authentication and Apple Pay.",
    tags: ["keyboard", "apple", "wireless"],
  },
  {
    name: "Samsung T7 Shield 2TB Portable SSD",
    slug: "samsung-t7-shield-2tb-portable-ssd",
    category: "physical",
    brand: "Samsung",
    amazon_asin: "B0B4C5D6E8",
    current_price: 119.99,
    previous_price: 159.99,
    image_url: "https://images.unsplash.com/photo-1597872200967-794b89f74db9?auto=format&fit=crop&w=800&q=80",
    description: "Rugged portable SSD with 1050MB/s read speeds and IP65 water and dust resistance.",
    tags: ["storage", "samsung", "portable"],
  },
  {
    name: "Sony SRS-XB100 Portable Speaker",
    slug: "sony-srs-xb100-portable-speaker",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B0C9D0E1F4",
    current_price: 39.99,
    previous_price: 59.99,
    image_url: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80",
    description: "Compact portable speaker with extra bass and 16-hour battery life.",
    tags: ["audio", "speaker", "portable"],
  },
  {
    name: "LG DualUp Monitor 28MQ750-B",
    slug: "lg-dualup-monitor-28mq750-b",
    category: "physical",
    brand: "LG",
    amazon_asin: "B0D2E3F4G5",
    current_price: 399.99,
    previous_price: 499.99,
    image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
    description: "Unique 16:18 aspect ratio monitor ideal for coding, multitasking, and content creation.",
    tags: ["monitor", "lg", "productivity"],
  },
  {
    name: "Logitech G713 Gaming Keyboard",
    slug: "logitech-g713-gaming-keyboard",
    category: "physical",
    brand: "Logitech",
    amazon_asin: "B0F1G2H3J4",
    current_price: 149.99,
    previous_price: 179.99,
    image_url: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80",
    description: "Low-profile gaming keyboard with GX mechanical switches and RGB lighting.",
    tags: ["keyboard", "logitech", "gaming"],
  },
  {
    name: "DJI Mic 2 Wireless Microphone",
    slug: "dji-mic-2-wireless-microphone",
    category: "physical",
    brand: "DJI",
    amazon_asin: "B0C5D6E7F9",
    current_price: 249.0,
    previous_price: 329.0,
    image_url: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80",
    description: "Professional wireless microphone with 32-bit float recording and noise cancellation.",
    tags: ["audio", "microphone", "dji"],
  },
  {
    name: "Razer Viper V3 Hyperspeed Mouse",
    slug: "razer-viper-v3-hyperspeed-mouse",
    category: "physical",
    brand: "Razer",
    amazon_asin: "B0H8I9J0K1",
    current_price: 139.99,
    previous_price: 159.99,
    image_url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
    description: "Esports-grade wireless mouse with Focus Pro 30K sensor and 90-hour battery.",
    tags: ["mouse", "razer", "gaming"],
  },
  {
    name: "Samsung Galaxy Buds2 Pro",
    slug: "samsung-galaxy-buds2-pro",
    category: "physical",
    brand: "Samsung",
    amazon_asin: "B0B8C9D0E4",
    current_price: 149.99,
    previous_price: 229.99,
    image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
    description: "Premium wireless earbuds with intelligent ANC and 360 audio.",
    tags: ["audio", "earbuds", "anc"],
  },
  {
    name: "Dell UltraSharp U2724D Monitor",
    slug: "dell-ultrasharp-u2724d-monitor",
    category: "physical",
    brand: "Dell",
    amazon_asin: "B0C5D6E7F0",
    current_price: 499.0,
    previous_price: 619.0,
    image_url: "https://images.unsplash.com/photo-1547119957-637f8679db1e?auto=format&fit=crop&w=800&q=80",
    description: "27-inch QHD IPS monitor with USB-C hub and 120Hz refresh rate.",
    tags: ["monitor", "dell", "productivity"],
  },
  {
    name: "Apple Pencil Pro",
    slug: "apple-pencil-pro",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0D3F4G5H8",
    current_price: 99.0,
    previous_price: 129.0,
    image_url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80",
    description: "Advanced Apple Pencil with squeeze, barrel roll, and haptic feedback.",
    tags: ["accessories", "apple", "stylus"],
  },
  {
    name: "Sony WH-CH720N Wireless Headphones",
    slug: "sony-wh-ch720n-wireless-headphones",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B0CY8L3N5Q",
    current_price: 148.0,
    previous_price: 198.0,
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    description: "Lightweight wireless noise cancelling headphones with 35-hour battery life.",
    tags: ["audio", "headphones", "anc"],
  },
  {
    name: "NordVPN 2-Year Ultimate Security Plan",
    slug: "nordvpn-2-year-ultimate-security-plan",
    category: "software",
    brand: "Nord Security",
    current_price: 83.76,
    previous_price: 286.8,
    image_url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80",
    description: "Complete VPN protection with 2-year subscription including all premium features.",
    tags: ["vpn", "security", "privacy"],
  },
  {
    name: "CleanMyMac X Multi-Device Lifetime",
    slug: "cleanmymac-x-multi-device-lifetime",
    category: "software",
    brand: "MacPaw",
    current_price: 59.95,
    previous_price: 89.95,
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    description: "Complete Mac optimization suite with malware removal and cleanup tools.",
    tags: ["mac", "utility", "optimization"],
  },
  {
    name: "Raycast Pro Annual Developer License",
    slug: "raycast-pro-annual-developer-license",
    category: "software",
    brand: "Raycast",
    current_price: 96.0,
    previous_price: 120.0,
    image_url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    description: "Productivity launcher for Mac with AI commands, snippets, and clipboard history.",
    tags: ["productivity", "ai", "launcher"],
  },
  {
    name: "1Password Families Annual Subscription",
    slug: "1password-families-annual-subscription",
    category: "software",
    brand: "1Password",
    current_price: 47.88,
    previous_price: 59.88,
    image_url: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=800&q=80",
    description: "Secure password manager for families with cross-platform support and Travel Mode.",
    tags: ["security", "passwords", "saas"],
  },
  {
    name: "Setapp Mac Apps Annual Bundle (240+ Apps)",
    slug: "setapp-mac-apps-annual-bundle-240-plus-apps",
    category: "software",
    brand: "Setapp",
    current_price: 107.88,
    previous_price: 119.88,
    image_url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
    description: "Subscription to 240+ premium Mac apps including CleanMyMac, Bartender, and iMazing.",
    tags: ["mac", "apps", "bundle"],
  },
  {
    name: "JetBrains All Products Pack 1st Year",
    slug: "jetbrains-all-products-pack-1st-year",
    category: "software",
    brand: "JetBrains",
    current_price: 289.0,
    previous_price: 499.0,
    image_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
    description: "Complete developer toolkit with IntelliJ IDEA, PyCharm, WebStorm, and more.",
    tags: ["developer", "ide", "jetbrains"],
  },
  {
    name: "Cursor Pro AI Code Editor Annual",
    slug: "cursor-pro-ai-code-editor-annual",
    category: "software",
    brand: "Cursor",
    current_price: 192.0,
    previous_price: 240.0,
    image_url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80",
    description: "AI-first code editor built on VS Code with intelligent code completion and chat.",
    tags: ["ai", "developer", "coding"],
  },
  {
    name: "Notion Plus Annual Plan with AI Add-On",
    slug: "notion-plus-annual-plan-with-ai-add-on",
    category: "software",
    brand: "Notion",
    current_price: 96.0,
    previous_price: 120.0,
    image_url: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=800&q=80",
    description: "All-in-one workspace with AI writing, databases, wikis, and project management.",
    tags: ["notes", "workspace", "productivity"],
  },
  {
    name: "Figma Professional Annual Team Seat",
    slug: "figma-professional-annual-team-seat",
    category: "software",
    brand: "Figma",
    current_price: 144.0,
    previous_price: 180.0,
    image_url: "https://images.unsplash.com/photo-1581291518633-83b4eb1d83e?auto=format&fit=crop&w=800&q=80",
    description: "Collaborative interface design tool with prototyping, design systems, and dev handoff.",
    tags: ["design", "ui", "collaboration"],
  },
  {
    name: "Surge for Mac Pro Multi-Device License",
    slug: "surge-for-mac-pro-multi-device-license",
    category: "software",
    brand: "Surge",
    current_price: 49.99,
    previous_price: 69.99,
    image_url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80",
    description: "Advanced network proxy and VPN client for Mac with powerful scripting support.",
    tags: ["networking", "mac", "developer"],
  },
  {
    name: "Adobe Photoshop + Lightroom Annual Plan",
    slug: "adobe-photoshop-lightroom-annual-plan",
    category: "software",
    brand: "Adobe",
    current_price: 119.88,
    previous_price: 239.88,
    image_url: "https://images.unsplash.com/photo-1572044162444-ad6029d2f68d?auto=format&fit=crop&w=800&q=80",
    description: "Professional photo editing and management with 100GB cloud storage included.",
    tags: ["design", "photo", "adobe"],
  },
  {
    name: "Microsoft 365 Family Annual Subscription",
    slug: "microsoft-365-family-annual-subscription",
    category: "software",
    brand: "Microsoft",
    current_price: 79.99,
    previous_price: 149.99,
    image_url: "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?auto=format&fit=crop&w=800&q=80",
    description: "Premium Office apps, 1TB OneDrive storage, and advanced security for up to 6 users.",
    tags: ["productivity", "microsoft", "office"],
  },
  {
    name: "Dashlane Password Manager Premium",
    slug: "dashlane-password-manager-premium",
    category: "software",
    brand: "Dashlane",
    current_price: 39.99,
    previous_price: 59.99,
    image_url: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=800&q=80",
    description: "Secure password manager with VPN, dark web monitoring, and secure notes.",
    tags: ["security", "passwords", "saas"],
  },
  {
    name: "Grammarly Premium Annual Plan",
    slug: "grammarly-premium-annual-plan",
    category: "software",
    brand: "Grammarly",
    current_price: 71.88,
    previous_price: 144.0,
    image_url: "https://images.unsplash.com/photo-1455390502266-744c9d7895ea?auto=format&fit=crop&w=800&q=80",
    description: "AI-powered writing assistant with grammar checking, tone detection, and clarity suggestions.",
    tags: ["writing", "ai", "productivity"],
  },
  {
    name: "Bartender 5 for Mac",
    slug: "bartender-5-for-mac",
    category: "software",
    brand: "Bartender",
    current_price: 16.0,
    previous_price: 25.0,
    image_url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80",
    description: "Organize your menu bar icons and keep your Mac desktop clean and focused.",
    tags: ["mac", "utility", "productivity"],
  },
  {
    name: "iMazing 3 Device Manager",
    slug: "imazing-3-device-manager",
    category: "software",
    brand: "iMazing",
    current_price: 49.99,
    previous_price: 69.99,
    image_url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80",
    description: "Transfer files, backup data, and manage your iPhone or iPad from your Mac or PC.",
    tags: ["mac", "utility", "ios"],
  },
  {
    name: "CleanMyPC 1-Year License",
    slug: "cleanmypc-1-year-license",
    category: "software",
    brand: "MacPaw",
    current_price: 19.95,
    previous_price: 39.95,
    image_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
    description: "PC optimization tool that removes junk files, protects privacy, and boosts performance.",
    tags: ["windows", "utility", "optimization"],
  },
  {
    name: "PDF Expert Annual Subscription",
    slug: "pdf-expert-annual-subscription",
    category: "software",
    brand: "PDF Expert",
    current_price: 49.99,
    previous_price: 79.99,
    image_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    description: "Best PDF editor for Mac with OCR, form filling, and cloud integration.",
    tags: ["mac", "pdf", "productivity"],
  },
  {
    name: "Magnet Window Manager for Mac",
    slug: "magnet-window-manager-for-mac",
    category: "software",
    brand: "Magnet",
    current_price: 9.99,
    previous_price: 19.99,
    image_url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80",
    description: "Simple window snapping tool to organize your desktop with keyboard shortcuts.",
    tags: ["mac", "utility", "productivity"],
  },
  {
    name: "Alfred 5 Powerpack",
    slug: "alfred-5-powerpack",
    category: "software",
    brand: "Alfred",
    current_price: 34.0,
    previous_price: 49.0,
    image_url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    description: "Boost your efficiency with keyboard shortcuts, snippets, and custom workflows.",
    tags: ["mac", "productivity", "launcher"],
  },
];

function generateSlugs(): ProductSeed[] {
  return CATALOG.map((item, index) => ({
    ...item,
    slug: item.slug || `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${index + 1}`,
  }));
}

const appUrl = env.NEXT_PUBLIC_APP_URL || "https://thinkabell.click";

// Env-driven Amazon affiliate link. Fails closed to the plain product
// URL when the partner tag is not configured — never a hardcoded tag.
function buildAmazonLink(asin: string): string | null {
  if (!isValidAsin(asin)) {
    console.warn(`[seed] Skipping malformed ASIN: ${asin}`);
    return null;
  }

  try {
    return generateAmazonAffiliateLink(asin);
  } catch (error) {
    if (error instanceof AmazonAffiliateLinkError) {
      console.warn(
        `[seed] Amazon partner tag not configured; storing plain product URL for ASIN ${asin}`,
      );
      return buildAmazonProductUrl(asin);
    }
    throw error;
  }
}

// Env-driven eBay affiliate link. Returns null (link skipped) when the
// campaign ID is not configured.
function buildEbayLink(epid: string): string | null {
  if (!env.EBAY_AFFILIATE_CAMPAIGN_ID) {
    console.warn(
      `[seed] eBay campaign ID not configured; skipping eBay link for EPID ${epid}`,
    );
    return null;
  }

  return `https://www.ebay.com/itm/${encodeURIComponent(epid)}?campid=${env.EBAY_AFFILIATE_CAMPAIGN_ID}&customid=thinkabell`;
}

export async function runSeeder(): Promise<void> {
  console.log("==========================================");
  console.log("  ThinkaBell 50 Product Seeder Launch     ");
  console.log("==========================================");
  console.log(
    "WARNING: bundled catalog is placeholder data (unverified ASINs/prices).",
  );
  console.log(
    "Replace with genuinely curated entries before relying on deal pages.",
  );

  const catalog = generateSlugs();
  console.log(`Seeding ${catalog.length} manually curated products.`);

  let insertedCount = 0;

  for (const item of catalog) {
    const affiliateLinks: Record<string, string> = {};
    if (item.amazon_asin) {
      const amazonLink = buildAmazonLink(item.amazon_asin);
      if (amazonLink) {
        affiliateLinks["amazon"] = amazonLink;
      }
    }
    if (item.ebay_epid) {
      const ebayLink = buildEbayLink(item.ebay_epid);
      if (ebayLink) {
        affiliateLinks["ebay"] = ebayLink;
      }
    }
    affiliateLinks["direct"] = `${appUrl}/deal/${item.slug}`;

    const { error } = await getSupabaseServiceClient().from("products").upsert(
      {
        name: item.name,
        slug: item.slug,
        category: item.category,
        brand: item.brand,
        amazon_asin: item.amazon_asin || null,
        ebay_epid: item.ebay_epid || null,
        affiliate_links: affiliateLinks,
        current_price: item.current_price,
        previous_price: item.previous_price,
        price_updated_at: new Date().toISOString(),
        image_url: item.image_url,
        description: item.description,
        tags: item.tags,
      },
      { onConflict: "slug" },
    );

    if (error) {
      console.warn(`Failed inserting ${item.name}:`, error.message);
    } else {
      insertedCount++;
    }
  }

  console.log(`Successfully seeded ${insertedCount}/${catalog.length} products to Supabase.`);
}

if (require.main === module) {
  runSeeder()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeder failed:", err);
      process.exit(1);
    });
}
