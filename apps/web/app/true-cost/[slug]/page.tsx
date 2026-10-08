import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Metadata } from "next";
import { getSupabaseAnonClient } from "@thinkabell/database";
import { buildAmazonCtaLink } from "@thinkabell/shared";
import type { Product } from "@thinkabell/shared";
import { TrueCostCalculator } from "../../../components/TrueCostCalculator";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

interface TrueCostPageProps {
  params: {
    slug: string;
  };
}

async function getDeal(slug: string): Promise<Product | null> {
  try {
    const { data: product, error } = await getSupabaseAnonClient()
      .from("products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !product) {
      return null;
    }

    return product as unknown as Product;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: TrueCostPageProps): Promise<Metadata> {
  const product = await getDeal(params.slug);
  if (!product) return { title: "Deal Not Found | ThinkaBell" };

  return {
    title: `True Cost: ${product.name} | ThinkaBell`,
    description: `Calculate the true cost of ${product.name} including hidden fees, setup costs, and recurring charges.`,
  };
}

export default async function TrueCostPage({ params }: TrueCostPageProps) {
  const product = await getDeal(params.slug);

  if (!product) {
    notFound();
  }

  const currentPrice = product.current_price ?? 0;

  // Geo-routed Amazon CTA (see deal page): same-origin
  // /go/amazon/:asin when a resolvable ASIN and a fully
  // configured marketplace exist, stored affiliate URLs otherwise.
  const visitorHeaders = await headers();
  const amazonCta = buildAmazonCtaLink({
    asin: product.amazon_asin,
    affiliateUrl: product.affiliate_links?.amazon,
    headers: visitorHeaders,
  });

  const affiliateUrl =
    amazonCta?.href ||
    product.affiliate_links?.amazon ||
    product.affiliate_links?.ebay ||
    product.affiliate_links?.direct ||
    product.affiliate_links?.impact ||
    "#";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/deal/${product.slug}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to deal</span>
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
          True Cost Calculator
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Understand the total cost of ownership for <strong>{product.name}</strong>
        </p>
      </div>

      <TrueCostCalculator
        dealPrice={currentPrice}
        dealName={product.name}
        description={product.description || undefined}
      />

      <div className="mt-8">
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
        >
          <span>View Deal on Retailer</span>
          <ExternalLink className="h-4 w-4" />
        </a>
        <p className="mt-2 text-center text-xs text-gray-500">
          ThinkaBell earns a commission from qualifying purchases at no extra cost to you.
        </p>
      </div>
    </div>
  );
}
