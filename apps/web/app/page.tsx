import { getSupabaseAnonClient } from "@thinkabell/database";
import { redis } from "@thinkabell/shared";
import type { Product } from "@thinkabell/shared";
import { DealCard } from "../components/DealCard";
import { SubscribeCTA } from "../components/SubscribeCTA";
import Link from "next/link";
import Image from "next/image";
import { Bell, Flame, ShieldCheck, Sparkles, Zap, Crown, Tag, TrendingDown, Search, BellRing, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 60; // ISR cache for 60 seconds

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "ThinkaBell | Real-Time Deal Alerts & Price Tracking",
    description: "Track price drops on AI hardware, smart gadgets, and software tools. Get instant alerts before deals expire.",
    alternates: { canonical: "/" },
  };
}

async function getDeals(): Promise<Product[]> {
  try {
    // 1. Try cache first
    const cached = await redis.get<Product[]>("top-deals");
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    // 2. Fetch from database
    const { data: topDeals, error } = await getSupabaseAnonClient()
      .from("products")
      .select("*")
      .order("price_updated_at", { ascending: false })
      .limit(24);

    if (error || !topDeals || topDeals.length === 0) {
      return [];
    }

    const deals = topDeals as unknown as Product[];
    // Cache for 60 seconds
    await redis.set("top-deals", deals, { ex: 60 });
    return deals;
  } catch {
    return [];
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

  const softwareDeals = deals.filter((d) => d.category === "software");
  const physicalDeals = deals.filter((d) => d.category === "physical");
  const dealOfTheDay = deals.find((d) => {
    const current = d.current_price ?? 0;
    const previous = d.previous_price ?? current;
    return previous > current && current > 0;
  }) ?? deals[0];

  return (
    <div className="space-y-16 pb-16">
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
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all min-h-[44px]"
            >
              <Bell className="h-5 w-5" />
              <span>Enable Free Deal Alerts</span>
            </Link>
            <a
              href="#deals"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-gray-800 border border-gray-200 hover:bg-gray-50 transition-all min-h-[44px]"
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
              <span>Checked on a fixed schedule (see /api/cron)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-blue-600" />
              <span>Instant Push & Email</span>
            </div>
          </div>
        </div>
      </section>

      {/* SaaS Section */}
      {softwareDeals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="h-5 w-5 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">SaaS & Software Deals</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Lifetime discounts, promo codes, and subscription bundles — updated in real-time.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {softwareDeals.slice(0, 3).map((product) => {
              const currentPrice = product.current_price ?? 0;
              const previousPrice = product.previous_price ?? currentPrice;
              const discountPercent = previousPrice > currentPrice && currentPrice > 0
                ? Math.round(((previousPrice - currentPrice) / previousPrice) * 100)
                : 0;

              return (
                <Link
                  key={product.id}
                  href={`/deal/${product.slug}`}
                  className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-all"
                >
                  {discountPercent >= 5 && (
                    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                      <Tag className="h-3.5 w-3.5" />
                      <span>{discountPercent}% OFF</span>
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                       <Image
                         src={product.image_url || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=200&q=80"}
                         alt={product.name}
                         fill
                         sizes="64px"
                         className="object-cover"
                       />
                    </div>
                    <div className="flex-1 min-w-0">
                      {product.brand && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
                          {product.brand}
                        </p>
                      )}
                      <h3 className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                        {product.description || "Track real-time price updates and historic discounts."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-3">
                    <div>
                      {discountPercent >= 5 && (
                        <p className="text-xs text-gray-500 line-through">
                          ${previousPrice.toFixed(2)}
                        </p>
                      )}
                      <p className="text-lg font-extrabold text-gray-900">
                        ${currentPrice.toFixed(2)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors min-h-[44px]">
                      <span>View Deal</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Deal of the Day */}
      {dealOfTheDay && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6">
            <Crown className="h-5 w-5 text-orange-500" />
            <h2 className="text-2xl font-bold text-gray-900">Deal of the Day</h2>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
               <div className="relative h-48 sm:h-56 w-full lg:w-80 flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm">
                 <Image
                   src={dealOfTheDay.image_url || "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80"}
                   alt={dealOfTheDay.name}
                   fill
                   sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 320px"
                   className="object-cover"
                 />
               </div>
              <div className="flex-1">
                {dealOfTheDay.brand && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
                    {dealOfTheDay.brand}
                  </p>
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {dealOfTheDay.name}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                  {dealOfTheDay.description || "Track real-time price updates and historic discounts."}
                </p>
                <div className="flex items-end gap-4 mb-6">
                  <div>
                  {dealOfTheDay.previous_price && dealOfTheDay.previous_price > (dealOfTheDay.current_price ?? 0) && (
                    <p className="text-sm text-gray-500 line-through">
                      ${dealOfTheDay.previous_price.toFixed(2)}
                    </p>
                  )}
                    <p className="text-3xl font-extrabold text-gray-900">
                      ${(dealOfTheDay.current_price ?? 0).toFixed(2)}
                    </p>
                  </div>
                  {dealOfTheDay.previous_price && dealOfTheDay.previous_price > (dealOfTheDay.current_price ?? 0) && (
                    <div className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white">
                      <TrendingDown className="h-4 w-4" />
                      <span>
                        {Math.round(((dealOfTheDay.previous_price - (dealOfTheDay.current_price ?? 0)) / dealOfTheDay.previous_price) * 100)}% OFF
                      </span>
                    </div>
                  )}
                </div>
                <Link
                  href={`/deal/${dealOfTheDay.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-700 transition-all min-h-[44px]"
                >
                  <Flame className="h-5 w-5" />
                  <span>View Today&#39;s Best Deal</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

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

      {/* How It Works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>
          <p className="text-sm text-gray-500 mt-1">Three simple steps to never miss a price drop</p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-4">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">1. Browse Deals</h3>
            <p className="mt-2 text-sm text-gray-600">Explore curated price drops across physical gadgets and software tools.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-4">
              <BellRing className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">2. Set Alerts</h3>
            <p className="mt-2 text-sm text-gray-600">Pick categories and minimum discount thresholds. We handle the rest.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">3. Act Fast</h3>
            <p className="mt-2 text-sm text-gray-600">Get instant email or push notifications when prices hit your target.</p>
          </div>
        </div>
      </section>

      <SubscribeCTA />
    </div>
  );
}
