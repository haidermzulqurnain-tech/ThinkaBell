import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { supabase } from "@thinkabell/database";
import type { Product, PriceHistory } from "@thinkabell/shared";
import { PriceHistoryChart } from "../../../components/PriceHistoryChart";
import { ArrowLeft, ExternalLink, ShieldCheck, Tag, TrendingDown } from "lucide-react";

interface DealPageProps {
  params: {
    slug: string;
  };
}

async function getDeal(slug: string): Promise<{ product: Product; history: PriceHistory[] } | null> {
  try {
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !product) return null;

    const { data: history } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", product.id)
      .order("recorded_at", { ascending: true });

    return {
      product: product as unknown as Product,
      history: (history ?? []) as unknown as PriceHistory[],
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: DealPageProps): Promise<Metadata> {
  const data = await getDeal(params.slug);
  if (!data) return { title: "Deal Not Found | ThinkaBell" };

  const { product } = data;
  const price = product.current_price ? `$${product.current_price}` : "Discounted";

  return {
    title: `${product.name} - Deal Alert ${price} | ThinkaBell`,
    description: product.description || `Get the lowest tracked price on ${product.name} at ThinkaBell.`,
    openGraph: {
      title: `${product.name} | ThinkaBell Deal`,
      description: `Tracked price drop to ${price}`,
      images: product.image_url ? [{ url: product.image_url }] : [],
    },
  };
}

export default async function DealPage({ params }: DealPageProps) {
  const data = await getDeal(params.slug);

  if (!data) {
    notFound();
  }

  const { product, history } = data;
  const currentPrice = product.current_price ?? 0;
  const previousPrice = product.previous_price ?? currentPrice;
  const hasDiscount = previousPrice > currentPrice && currentPrice > 0;
  const discountPercent = hasDiscount
    ? Math.round(((previousPrice - currentPrice) / previousPrice) * 100)
    : 0;

  // Primary affiliate destination link
  const affiliateUrl =
    product.affiliate_links?.amazon ||
    product.affiliate_links?.ebay ||
    product.affiliate_links?.direct ||
    product.affiliate_links?.impact ||
    "#";

  // Schema.org JSON-LD Structured Data for Google SEO
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: product.image_url ? [product.image_url] : [],
    description: product.description,
    brand: {
      "@type": "Brand",
      name: product.brand || "ThinkaBell",
    },
    offers: {
      "@type": "Offer",
      url: `https://thinkabell.click/deal/${product.slug}`,
      priceCurrency: "USD",
      price: currentPrice,
      availability: "https://schema.org/InStock",
      priceValidUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split("T")[0],
    },
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to all deals</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Product Image Showcase */}
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          {discountPercent >= 5 && (
            <div className="absolute left-6 top-6 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>{discountPercent}% SAVINGS</span>
            </div>
          )}

          <div className="relative h-full w-full">
            <Image
              src={
                product.image_url ||
                "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80"
              }
              alt={product.name}
              fill
              priority
              className="object-contain"
              unoptimized
            />
          </div>
        </div>

        {/* Product Details & Action */}
        <div className="flex flex-col justify-center">
          {product.brand && (
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
              {product.brand}
            </p>
          )}

          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
            {product.name}
          </h1>

          {/* Pricing Block */}
          <div className="mt-6 flex items-baseline gap-4 rounded-2xl bg-blue-50/70 p-5 border border-blue-100">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Tracked Deal Price</p>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 mt-1">
                ${currentPrice.toFixed(2)}
              </p>
            </div>

            {hasDiscount && (
              <div>
                <p className="text-xs text-gray-400">Regular Price</p>
                <p className="text-lg text-gray-400 line-through">
                  ${previousPrice.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Direct Affiliate CTA */}
          <div className="mt-6">
            <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
            >
              <span>View Deal on Retailer</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="mt-2 text-center text-xs text-gray-400">
              Prices and availability are verified periodically and subject to change.
            </p>
          </div>

          {/* Verification Badges */}
          <div className="mt-6 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Verified Merchant</span>
            </div>
            <div className="flex items-center gap-1">
              <Tag className="h-4 w-4 text-blue-600" />
              <span className="capitalize">{product.category} Category</span>
            </div>
          </div>
        </div>
      </div>

      {/* Price History Chart Section */}
      <div className="mt-12">
        <PriceHistoryChart history={history} currentPrice={currentPrice} />
      </div>

      {/* Description & Tags */}
      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">About this deal</h2>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          {product.description ||
            "No description provided. This item is tracked by ThinkaBell automated price checking spiders."}
        </p>

        {product.tags && product.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
