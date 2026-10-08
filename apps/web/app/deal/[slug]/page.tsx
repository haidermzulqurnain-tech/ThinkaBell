import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { env } from "@thinkabell/config";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSupabaseAnonClient } from "@thinkabell/database";
import { buildAmazonCtaLink } from "@thinkabell/shared";
import type { Product, PriceHistory } from "@thinkabell/shared";
import { PriceHistoryChart } from "../../../components/PriceHistoryChart";
import { ArrowLeft, ExternalLink, ShieldCheck, Tag, TrendingDown } from "lucide-react";
import { getNonce } from "../../../lib/csp";
import { fallbackImageUrl } from "../../../lib/fallbackImages";
import { TransparencyBanner } from "../../../components/TransparencyBanner";
import { DealCountdown } from "../../../components/DealCountdown";
import { PromoCodeCopy } from "../../../components/PromoCodeCopy";
import { PriceFreshnessBadge } from "../../../components/PriceFreshnessBadge";
import { SubscribeModalClient } from "../../../components/SubscribeModalClient";

interface DealPageProps {
  params: {
    slug: string;
  };
}

async function getDeal(slug: string): Promise<{ product: Product; history: PriceHistory[]; related: Product[] } | null> {
  try {
    const { data: product, error } = await getSupabaseAnonClient()
      .from("products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !product) {
      return null;
    }

    const { data: history } = await getSupabaseAnonClient()
      .from("price_history")
      .select("*")
      .eq("product_id", product.id)
      .order("recorded_at", { ascending: true });

    const { data: related } = await getSupabaseAnonClient()
      .from("products")
      .select("*")
      .eq("category", product.category)
      .neq("slug", slug)
      .not("current_price", "is", null)
      .order("price_updated_at", { ascending: false })
      .limit(6);

    return {
      product: product as unknown as Product,
      history: (history ?? []) as unknown as PriceHistory[],
      related: (related ?? []) as unknown as Product[],
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
  const nonce = await getNonce();
  const data = await getDeal(params.slug);

  if (!data) {
    notFound();
  }

  const { product, history, related } = data;
  const currentPrice = product.current_price ?? 0;
  const previousPrice = product.previous_price ?? currentPrice;
  const hasDiscount = previousPrice > currentPrice && currentPrice > 0;
  const discountPercent = hasDiscount
    ? Math.round(((previousPrice - currentPrice) / previousPrice) * 100)
    : 0;

  // Geo-routed Amazon CTA. When the product has a resolvable ASIN and
  // the visitor's marketplace is fully configured, the CTA points at the
  // same-origin /go/amazon/:asin route, which redirects (at the edge or
  // on this origin) to the visitor's regional storefront with the
  // regional partner tag. Falls back to stored affiliate URLs when geo
  // routing fails closed (no ASIN or unconfigured marketplace).
  const visitorHeaders = await headers();
  const amazonCta = buildAmazonCtaLink({
    asin: product.amazon_asin,
    affiliateUrl: product.affiliate_links?.amazon,
    headers: visitorHeaders,
  });

  // Primary affiliate destination link
  const affiliateUrl =
    amazonCta?.href ||
    product.affiliate_links?.amazon ||
    product.affiliate_links?.ebay ||
    product.affiliate_links?.direct ||
    product.affiliate_links?.impact ||
    "#";

  // Schema.org JSON-LD Structured Data for Google SEO and AEO
  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    ...(product.image_url ? { image: product.image_url } : {}),
    description: product.description,
    brand: {
      "@type": "Brand",
      name: product.brand || "ThinkaBell",
    },
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/deal/${product.slug}`,
      priceCurrency: "USD",
      price: currentPrice,
      availability: "https://schema.org/InStock",
      priceValidUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split("T")[0],
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Deals",
        item: `${baseUrl}/deals`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${baseUrl}/deal/${product.slug}`,
      },
    ],
  };

  const speakableJsonLd = {
    "@context": "https://schema.org",
    "@type": "SpeakableSpecification",
    cssSelector: [".deal-title", ".deal-price", ".deal-summary"],
  };

  const faqJsonLd = {
    "@context": "https://schema.org/",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is the current price of ${product.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `The current tracked price of ${product.name} is $${currentPrice.toFixed(2)}. ${hasDiscount ? `This is ${discountPercent}% off the regular price of $${previousPrice.toFixed(2)}.` : "Check back for price drops."}`,
        },
      },
      {
        "@type": "Question",
        name: `Where can I buy ${product.name} at the best price?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `You can purchase ${product.name} through our verified affiliate link. We track prices from multiple retailers to ensure you get the best deal available.`,
        },
      },
      {
        "@type": "Question",
        name: "How often do you update prices?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We check prices on a fixed schedule to ensure you always have access to the most current pricing information.",
        },
      },
    ],
  };

  const howToJsonLd = {
    "@context": "https://schema.org/",
    "@type": "HowTo",
    name: `How to Get the Best Deal on ${product.name}`,
    description: `Learn how to purchase ${product.name} at the lowest price with ThinkaBell deal tracking.`,
    step: [
      {
        "@type": "HowToStep",
        name: "Check current price",
        text: `View the current tracked price of ${product.name}, which is $${currentPrice.toFixed(2)}.`,
        url: `${baseUrl}/deal/${product.slug}`,
      },
      {
        "@type": "HowToStep",
        name: "Click the deal link",
        text: "Click through to the verified retailer to complete your purchase at the advertised price.",
      },
      {
        "@type": "HowToStep",
        name: "Set up price alerts",
        text: "Subscribe to deal alerts to get notified when prices drop even further on this or similar products.",
      },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* JSON-LD Scripts */}
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to all deals</span>
      </Link>

      {/* Transparency Banner - above the fold for FTC compliance */}
      <div className="mb-6">
        <TransparencyBanner dealType={product.deal_type ?? undefined} />
      </div>

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
              src={product.image_url || fallbackImageUrl(product.category, 800)}
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

          <h1 className="deal-title text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
            {product.name}
          </h1>

          {/* Pricing Block */}
          <div className="mt-6 flex items-baseline gap-4 rounded-2xl bg-blue-50/70 p-5 border border-blue-100">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Tracked Deal Price</p>
              <p className="deal-price text-3xl sm:text-4xl font-black text-gray-900 mt-1">
                ${currentPrice.toFixed(2)}
              </p>
            </div>

            {hasDiscount && (
              <div>
                <p className="text-xs text-gray-500">Regular Price</p>
                <p className="text-lg text-gray-500 line-through">
                  ${previousPrice.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Primary affiliate destination link */}
          <div className="mt-6">
            <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              <span>View Deal on Retailer</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="mt-2 text-center text-xs text-gray-500">
              ThinkaBell earns a commission from qualifying purchases at no extra cost to you.
            </p>
          </div>

          {/* SaaS Track: Promo Code + Countdown */}
          {product.category === "software" && product.promo_code && (
            <div className="mt-6 space-y-4">
              <PromoCodeCopy code={product.promo_code} />
              {product.deal_end_date && (
                <DealCountdown endDate={product.deal_end_date} />
              )}
            </div>
          )}

          {/* Price Freshness */}
          <div className="mt-4">
            <PriceFreshnessBadge updatedAt={product.price_updated_at ?? new Date().toISOString()} />
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

      {/* Related Products Section */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-bold text-gray-900 mb-4">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((relatedProduct) => (
              <Link
                key={relatedProduct.slug}
                href={`/deal/${relatedProduct.slug}`}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="relative h-32 w-full overflow-hidden rounded-xl bg-gray-100 mb-4">
                  <Image
                    src={relatedProduct.image_url || fallbackImageUrl(relatedProduct.category, 400)}
                    alt={relatedProduct.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <h3 className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {relatedProduct.name}
                </h3>
                <p className="mt-2 text-lg font-extrabold text-gray-900">
                  ${relatedProduct.current_price?.toFixed(2)}
                </p>
                {relatedProduct.brand && (
                  <p className="mt-1 text-xs text-gray-500">{relatedProduct.brand}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Description & Tags */}
      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">About this deal</h2>
        
        {/* TL;DR Block */}
        <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">TL;DR</h3>
          <p className="text-sm text-blue-800 leading-relaxed">
            {product.description
              ? product.description.length > 200
                ? product.description.slice(0, 200) + "..."
                : product.description
              : "No summary available for this deal."}
          </p>
        </div>

        {/* Best For Badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            Best for {product.category === "physical" ? "Shoppers" : "Teams"}
          </span>
          {discountPercent >= 20 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800">
              Hot Deal
            </span>
          )}
          {product.brand && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
              {product.brand}
            </span>
          )}
        </div>

        <p className="deal-summary mt-4 text-sm text-gray-600 leading-relaxed">
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

        <button
          onClick={() => document.dispatchEvent(new CustomEvent('open-subscribe-modal'))}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
        >
          Get Notified When Price Drops
        </button>

        <Link
          href={`/true-cost/${product.slug}`}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Calculate True Cost
        </Link>
      </div>

      <SubscribeModalClient productSlug={product.slug} />
    </div>
  );
}
