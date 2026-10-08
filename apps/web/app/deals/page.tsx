import { Suspense } from "react";
import Link from "next/link";
import { env } from "@thinkabell/config";
import Image from "next/image";
import { DealCard } from "@/components/DealCard";
import { DealFilters } from "@/components/DealFilters";
import { getNonce } from "@/lib/csp";
import { fetchDeals as fetchDealsData, normalizeCategory, type DealsQuery } from "@/lib/catalog";
import { Search } from "lucide-react";
import type { Metadata } from "next";

interface DealsPageProps {
  searchParams?: {
    category?: string;
    deal_type?: string;
    min_discount?: string;
    sort?: string;
    cursor?: string;
  };
}

export async function generateMetadata({ searchParams }: DealsPageProps): Promise<Metadata> {
  const params = {
    category: searchParams?.category,
    deal_type: searchParams?.deal_type,
    min_discount: searchParams?.min_discount,
    sort: searchParams?.sort,
    cursor: searchParams?.cursor,
  };

  const data = await fetchDeals(params);
  const category = searchParams?.category;
  const title = category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Deals | ThinkaBell` : "All Deals | ThinkaBell";
  const description = category
    ? `Browse the best ${category} deals and discounts. Track prices and get alerts on ${category} products.`
    : "Browse all deals across AI hardware, smart gadgets, and software tools. Find the best discounts and track price drops.";

  return {
    title,
    description,
    alternates: { canonical: "/deals" },
    robots: data.count > 0 ? undefined : { index: false, follow: true },
  };
}

async function fetchDeals(params: Record<string, string | undefined>) {
  try {
    return await fetchDealsData({
      category: normalizeCategory(params.category),
      deal_type: params.deal_type,
      min_discount: params.min_discount ? Number(params.min_discount) : undefined,
      sort: (params.sort as DealsQuery["sort"]) || undefined,
      cursor: params.cursor,
    });
  } catch {
    return { results: [], count: 0, nextCursor: null, hasMore: false };
  }
}

function DealsGrid({ deals }: { deals: any[] }) {
  if (deals.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <Search className="mx-auto h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-bold text-gray-900">No deals found</h2>
        <p className="mt-2 text-sm text-gray-500">
          Try adjusting your filters or browse all categories.
        </p>
        <Link
          href="/deals"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Clear Filters
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {deals.map((product) => (
        <DealCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function DealsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mb-4" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2 mb-2" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-full mb-4" />
          <div className="flex items-end justify-between">
            <div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-16 mb-1" />
              <div className="h-6 bg-gray-200 rounded animate-pulse w-20" />
            </div>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const nonce = await getNonce();
  const params = {
    category: searchParams?.category,
    deal_type: searchParams?.deal_type,
    min_discount: searchParams?.min_discount,
    sort: searchParams?.sort,
    cursor: searchParams?.cursor,
  };

  const data = await fetchDeals(params);

  const buildCursorHref = (cursor: string) => {
    const sp = new URLSearchParams();
    if (params.category) sp.set("category", params.category);
    if (params.deal_type) sp.set("deal_type", params.deal_type);
    if (params.min_discount) sp.set("min_discount", params.min_discount);
    if (params.sort) sp.set("sort", params.sort);
    sp.set("cursor", cursor);
    return `/deals?${sp.toString()}`;
  };

  const baseUrl = env.NEXT_PUBLIC_APP_URL;

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
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">All Deals</h1>
        <p className="mt-2 text-sm text-gray-500">
          Browse all active price drops across AI hardware, smart gadgets, and software tools.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          <strong>Affiliate Disclosure:</strong> ThinkaBell participates in affiliate programs and may earn a commission from qualifying purchases made through our links at no additional cost to you.
        </p>
      </div>

      <DealFilters
        selectedCategory={params.category}
        selectedDealType={params.deal_type}
        minDiscount={params.min_discount ? Number(params.min_discount) : undefined}
        sort={params.sort}
      />

      <div className="mt-8">
        <Suspense fallback={<DealsSkeleton />}>
          <DealsGrid deals={data.results} />
        </Suspense>
      </div>

      {data.hasMore && data.nextCursor && (
        <div className="mt-10 flex justify-center">
          <Link
            href={buildCursorHref(data.nextCursor)}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors min-h-[44px] inline-flex items-center justify-center"
          >
            Load More
          </Link>
        </div>
      )}

      <div className="mt-8">
        <Link
          href="/"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          ← Back to homepage
        </Link>
      </div>
    </div>
  );
}
