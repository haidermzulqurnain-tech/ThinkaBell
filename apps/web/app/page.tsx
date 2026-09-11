import { supabase } from "@thinkabell/database";
import { redis } from "@thinkabell/shared";
import type { Product } from "@thinkabell/shared";
import { DealCard } from "../components/DealCard";
import Link from "next/link";
import { Bell, Flame, ShieldCheck, Sparkles } from "lucide-react";

export const revalidate = 60; // ISR cache for 60 seconds

// Baseline mock deals if database is empty during initial setup
const FALLBACK_DEALS: Product[] = [
  {
    id: 1,
    name: 'Apple MacBook Pro 14" M3 Pro (18GB/512GB)',
    slug: "apple-macbook-pro-14-m3-pro",
    category: "physical",
    brand: "Apple",
    amazon_asin: "B0CM5N4G3T",
    affiliate_links: { amazon: "https://amazon.com/dp/B0CM5N4G3T?tag=thinkabell-20" },
    current_price: 1749.0,
    previous_price: 1999.0,
    price_updated_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
    description: "The 14-inch MacBook Pro with M3 Pro chip delivers extreme performance for demanding workflows.",
    tags: ["laptop", "apple", "hardware"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: "Sony WH-1000XM5 Wireless Noise-Canceling Headphones",
    slug: "sony-wh-1000xm5-wireless-headphones",
    category: "physical",
    brand: "Sony",
    amazon_asin: "B09XS7JWHH",
    affiliate_links: { amazon: "https://amazon.com/dp/B09XS7JWHH?tag=thinkabell-20" },
    current_price: 328.0,
    previous_price: 399.99,
    price_updated_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    description: "Industry-leading noise cancellation with two processors and 8 microphones for unprecedented call clarity.",
    tags: ["audio", "headphones", "sony"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    name: "NordVPN 2-Year Ultimate Security Suite",
    slug: "nordvpn-2-year-ultimate-plan",
    category: "software",
    brand: "Nord Security",
    affiliate_links: { direct: "https://nordvpn.com/order/?affid=thinkabell" },
    current_price: 83.76,
    previous_price: 286.8,
    price_updated_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80",
    description: "Next-generation encrypted VPN, Threat Protection anti-malware, and 1TB cloud storage.",
    tags: ["vpn", "security", "software"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 4,
    name: "CleanMyMac X Multi-Device License",
    slug: "cleanmymac-x-multi-device",
    category: "software",
    brand: "MacPaw",
    affiliate_links: { direct: "https://macpaw.com/cleanmymac?aff=thinkabell" },
    current_price: 59.95,
    previous_price: 89.95,
    price_updated_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    description: "All-in-one optimizer and malware removal suite built exclusively for macOS.",
    tags: ["mac", "utility", "software"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function getDeals(): Promise<Product[]> {
  try {
    // 1. Try cache first
    const cached = await redis.get<Product[]>("top-deals");
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    // 2. Fetch from database
    const { data: topDeals, error } = await supabase
      .from("products")
      .select("*")
      .order("price_updated_at", { ascending: false })
      .limit(24);

    if (error || !topDeals || topDeals.length === 0) {
      return FALLBACK_DEALS;
    }

    const deals = topDeals as unknown as Product[];
    // Cache for 60 seconds
    await redis.set("top-deals", deals, { ex: 60 });
    return deals;
  } catch {
    return FALLBACK_DEALS;
  }
}

interface HomePageProps {
  searchParams?: {
    category?: string;
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const deals = await getDeals();
  const selectedCategory = searchParams?.category;

  const filteredDeals = selectedCategory
    ? deals.filter((d) => d.category.toLowerCase() === selectedCategory.toLowerCase())
    : deals;

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/80 to-white py-16 sm:py-24 border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3.5 py-1 text-xs font-semibold text-blue-800 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>Real-time price monitoring across Amazon, eBay & Software</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Never Miss a <span className="text-blue-600">Price Drop</span> Again
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            We scan prices 24/7. When AI gadgets, developer hardware, or software subscriptions drop in price, you get an instant push or email alert.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/subscribe"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all"
            >
              <Bell className="h-5 w-5" />
              <span>Enable Free Deal Alerts</span>
            </Link>
            <a
              href="#deals"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              <Flame className="h-5 w-5 text-orange-500" />
              <span>Browse Active Drops</span>
            </a>
          </div>

          {/* Social Proof badges */}
          <div className="mt-12 flex flex-wrap justify-center items-center gap-8 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Verified Affiliate Links</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500" />
              <span>Checked Every 15 Minutes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-blue-600" />
              <span>Instant Push & Email</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Deals Showcase */}
      <section id="deals" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Filter Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Featured Price Drops</h2>
            <p className="text-sm text-gray-500 mt-1">
              Showing {filteredDeals.length} active deals with confirmed discounts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                !selectedCategory
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Deals
            </Link>
            <Link
              href="/?category=physical"
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                selectedCategory === "physical"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Physical Gadgets
            </Link>
            <Link
              href="/?category=software"
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                selectedCategory === "software"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Software & SaaS
            </Link>
          </div>
        </div>

        {/* Deals Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDeals.map((product) => (
            <DealCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
