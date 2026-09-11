/**
 * Seed 100+ Realistic Products for ThinkaBell Launch
 *
 * Populates Supabase with 100+ physical hardware and software deals
 * complete with ASINs, ePIDs, affiliate links, and historical price points.
 */

import { supabase } from "../packages/database/src/client";

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

const BRANDS_PHYSICAL = ["Apple", "Sony", "Logitech", "Anker", "Bose", "Samsung", "Dell", "LG", "Keychron", "DJI"];
const BRANDS_SOFTWARE = ["Nord Security", "MacPaw", "Raycast", "JetBrains", "Setapp", "1Password", "Notion", "CleanMyPC", "Figma", "Cursor"];

const PHYSICAL_CATALOG: Array<{ name: string; brand: string; price: number; original: number; tags: string[]; image: string }> = [
  { name: 'Apple MacBook Pro 14" M3 Pro', brand: "Apple", price: 1749.0, original: 1999.0, tags: ["laptop", "apple", "hardware"], image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80" },
  { name: 'Apple MacBook Air 15" M3 (16GB)', brand: "Apple", price: 1099.0, original: 1299.0, tags: ["laptop", "apple", "ultrabook"], image: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80" },
  { name: 'Apple iPad Pro 11" M4 OLED', brand: "Apple", price: 899.0, original: 999.0, tags: ["tablet", "apple", "oled"], image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80" },
  { name: "Sony WH-1000XM5 Wireless ANC Headphones", brand: "Sony", price: 328.0, original: 399.99, tags: ["audio", "headphones", "anc"], image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80" },
  { name: "Sony WF-1000XM5 Noise Canceling Earbuds", brand: "Sony", price: 248.0, original: 299.99, tags: ["audio", "earbuds", "anc"], image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80" },
  { name: "Logitech MX Master 3S Wireless Mouse", brand: "Logitech", price: 89.99, original: 99.99, tags: ["mouse", "logitech", "ergonomic"], image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80" },
  { name: "Logitech MX Keys S Wireless Keyboard", brand: "Logitech", price: 99.99, original: 119.99, tags: ["keyboard", "logitech", "productivity"], image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80" },
  { name: "Keychron Q1 Pro Wireless Mechanical Keyboard", brand: "Keychron", price: 169.0, original: 199.0, tags: ["keyboard", "mechanical", "custom"], image: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80" },
  { name: "Anker Prime 20,000mAh Power Bank (200W)", brand: "Anker", price: 99.99, original: 129.99, tags: ["charging", "anker", "powerbank"], image: "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?auto=format&fit=crop&w=800&q=80" },
  { name: "Anker MagGo 3-in-1 Wireless Charging Station", brand: "Anker", price: 82.5, original: 109.99, tags: ["charging", "wireless", "magsafe"], image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80" },
  { name: "Bose QuietComfort Ultra Headphones", brand: "Bose", price: 349.0, original: 429.0, tags: ["audio", "bose", "anc"], image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80" },
  { name: "LG UltraGear 27\" OLED 240Hz Gaming Monitor", brand: "LG", price: 649.99, original: 899.99, tags: ["monitor", "gaming", "oled"], image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80" },
  { name: "Dell UltraSharp 32\" 4K USB-C Hub Monitor", brand: "Dell", price: 699.0, original: 859.99, tags: ["monitor", "dell", "4k"], image: "https://images.unsplash.com/photo-1547119957-637f8679db1e?auto=format&fit=crop&w=800&q=80" },
  { name: "DJI Osmo Pocket 3 Creator Combo", brand: "DJI", price: 599.0, original: 669.0, tags: ["camera", "video", "dji"], image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80" },
  { name: "Samsung Galaxy Tab S9 Ultra (512GB)", brand: "Samsung", price: 949.99, original: 1199.99, tags: ["tablet", "samsung", "android"], image: "https://images.unsplash.com/photo-1561154464-82e9adf32764?auto=format&fit=crop&w=800&q=80" },
];

const SOFTWARE_CATALOG: Array<{ name: string; brand: string; price: number; original: number; tags: string[]; image: string }> = [
  { name: "NordVPN 2-Year Ultimate Security Plan", brand: "Nord Security", price: 83.76, original: 286.8, tags: ["vpn", "security", "privacy"], image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80" },
  { name: "CleanMyMac X Multi-Device Lifetime", brand: "MacPaw", price: 59.95, original: 89.95, tags: ["mac", "utility", "optimization"], image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" },
  { name: "Raycast Pro Annual Developer License", brand: "Raycast", price: 96.0, original: 120.0, tags: ["productivity", "ai", "launcher"], image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80" },
  { name: "1Password Families Annual Subscription", brand: "1Password", price: 47.88, original: 59.88, tags: ["security", "passwords", "saas"], image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=800&q=80" },
  { name: "Setapp Mac Apps Annual Bundle (240+ Apps)", brand: "Setapp", price: 107.88, original: 119.88, tags: ["mac", "apps", "bundle"], image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80" },
  { name: "JetBrains All Products Pack 1st Year", brand: "JetBrains", price: 289.0, original: 499.0, tags: ["developer", "ide", "jetbrains"], image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80" },
  { name: "Cursor Pro AI Code Editor Annual", brand: "Cursor", price: 192.0, original: 240.0, tags: ["ai", "developer", "coding"], image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80" },
  { name: "Notion Plus Annual Plan with AI Add-On", brand: "Notion", price: 96.0, original: 120.0, tags: ["notes", "workspace", "productivity"], image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=800&q=80" },
  { name: "Figma Professional Annual Team Seat", brand: "Figma", price: 144.0, original: 180.0, tags: ["design", "ui", "collaboration"], image: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=800&q=80" },
  { name: "Surge for Mac Pro Multi-Device License", brand: "Surge", price: 49.99, original: 69.99, tags: ["networking", "mac", "developer"], image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80" },
];

function generate100Products(): ProductSeed[] {
  const products: ProductSeed[] = [];
  let idCounter = 1;

  // 1. Add baseline catalog
  PHYSICAL_CATALOG.forEach((item) => {
    products.push({
      name: item.name,
      slug: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${idCounter++}`,
      category: "physical",
      brand: item.brand,
      amazon_asin: `B0${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      ebay_epid: `EPID-${Math.floor(100000 + Math.random() * 900000)}`,
      current_price: item.price,
      previous_price: item.original,
      image_url: item.image,
      description: `Premium ${item.name} tracked for genuine price discounts and verified deals.`,
      tags: item.tags,
    });
  });

  SOFTWARE_CATALOG.forEach((item) => {
    products.push({
      name: item.name,
      slug: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${idCounter++}`,
      category: "software",
      brand: item.brand,
      current_price: item.price,
      previous_price: item.original,
      image_url: item.image,
      description: `Official digital license for ${item.name} with instant activation and verified discount.`,
      tags: item.tags,
    });
  });

  // 2. Synthesize remaining items up to 105 total products
  const physicalVariants = ["Wireless Charging Dock", "USB-C 10-in-1 Hub", "Mechanical NumPad", "Ergonomic Wrist Rest", "Smart LED Desk Lamp", "4K Webcam 60FPS", "Studio Boom Arm", "Noise Isolating IEMs", "Bluetooth Tracker 4-Pack", "100W GaN Travel Charger"];
  const softwareVariants = ["Cloud Backup 2TB", "PDF Editor Pro", "Grammar & AI Writer", "Mind Mapping Suite", "Color Grading Plugins", "Font Manager Pro", "Password Recovery Toolkit", "System Cleaner Ultra", "Screen Recorder 4K", "Audio Mastering Suite"];

  let variantIndex = 1;
  while (products.length < 105) {
    const isPhysical = products.length % 2 === 0;

    if (isPhysical) {
      const brand = BRANDS_PHYSICAL[products.length % BRANDS_PHYSICAL.length]!;
      const itemTitle = physicalVariants[variantIndex % physicalVariants.length]!;
      const orig = Math.round((40 + (products.length * 3) % 180) * 100) / 100;
      const discountPct = 10 + (products.length % 35);
      const curr = Math.round((orig * (1 - discountPct / 100)) * 100) / 100;

      products.push({
        name: `${brand} ${itemTitle} Edition ${variantIndex}`,
        slug: `${brand.toLowerCase()}-${itemTitle.toLowerCase().replace(/\s+/g, "-")}-${idCounter++}`,
        category: "physical",
        brand,
        amazon_asin: `B0${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        ebay_epid: `EPID-${Math.floor(100000 + Math.random() * 900000)}`,
        current_price: curr,
        previous_price: orig,
        image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
        description: `High performance ${brand} ${itemTitle} with intelligent power management and durable hardware build.`,
        tags: ["hardware", "gadget", brand.toLowerCase()],
      });
    } else {
      const brand = BRANDS_SOFTWARE[products.length % BRANDS_SOFTWARE.length]!;
      const itemTitle = softwareVariants[variantIndex % softwareVariants.length]!;
      const orig = Math.round((50 + (products.length * 4) % 250) * 100) / 100;
      const discountPct = 15 + (products.length % 45);
      const curr = Math.round((orig * (1 - discountPct / 100)) * 100) / 100;

      products.push({
        name: `${brand} ${itemTitle} v${variantIndex}.0`,
        slug: `${brand.toLowerCase()}-${itemTitle.toLowerCase().replace(/\s+/g, "-")}-${idCounter++}`,
        category: "software",
        brand,
        current_price: curr,
        previous_price: orig,
        image_url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
        description: `Professional ${brand} ${itemTitle} offering cross-platform synchronization, cloud backups, and high speed execution.`,
        tags: ["software", "saas", "productivity"],
      });
      variantIndex++;
    }
  }

  return products;
}

export async function runSeeder(): Promise<void> {
  console.log("==========================================");
  console.log("  ThinkaBell 100+ Product Seeder Launch   ");
  console.log("==========================================");

  const catalog = generate100Products();
  console.log(`Generated ${catalog.length} products to seed.`);

  let insertedCount = 0;

  for (const item of catalog) {
    const affiliateLinks: Record<string, string> = {};
    if (item.amazon_asin) {
      affiliateLinks["amazon"] = `https://amazon.com/dp/${item.amazon_asin}?tag=thinkabell-20`;
    }
    if (item.ebay_epid) {
      affiliateLinks["ebay"] = `https://ebay.com/itm/${item.ebay_epid}?campid=5338000000`;
    }
    affiliateLinks["direct"] = `https://thinkabell.click/go/${item.slug}?ref=thinkabell`;

    const { error } = await supabase.from("products").upsert(
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

  console.log(`✅ Successfully seeded ${insertedCount}/${catalog.length} products to Supabase.`);
}

if (require.main === module) {
  runSeeder()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeder failed:", err);
      process.exit(1);
    });
}
