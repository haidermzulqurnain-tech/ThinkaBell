import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { DealCard } from "@/components/DealCard";
import { searchProducts, normalizeCategory } from "@/lib/catalog";

interface SearchPageProps {
  searchParams?: {
    q?: string;
    category?: string;
    cursor?: string;
  };
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const query = searchParams?.q;
  const title = query ? `Search results for "${query}" | ThinkaBell` : "Search Deals | ThinkaBell";
  const description = query
    ? `Find the best deals on "${query}". Track prices and get alerts.`
    : "Search for deals across AI hardware, smart gadgets, and software tools.";

  return {
    title,
    description,
    alternates: { canonical: "/search" },
    robots: query ? undefined : { index: false, follow: true },
  };
}

async function searchDeals(query: string, category?: string, cursor?: string) {
  try {
    return await searchProducts({
      q: query || undefined,
      category: normalizeCategory(category),
      cursor: cursor || undefined,
    });
  } catch {
    return { results: [], count: 0, nextCursor: null };
  }
}

function SearchResults({ query, category, cursor }: { query: string; category?: string; cursor?: string }) {
  const data = searchDeals(query, category, cursor);

  if (!query) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <Search className="mx-auto h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-bold text-gray-900">Start typing to search</h2>
        <p className="mt-2 text-sm text-gray-500">
          Search across deals, brands, categories, and software tools.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchResultsInner query={query} category={category} cursor={cursor} />
    </Suspense>
  );
}

async function SearchResultsInner({ query, category, cursor }: { query: string; category?: string; cursor?: string }) {
  const data = await searchDeals(query, category, cursor);

  if (data.count === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <Search className="mx-auto h-10 w-10 text-gray-300" />
        <h2 className="mt-4 text-lg font-bold text-gray-900">No results found</h2>
        <p className="mt-2 text-sm text-gray-500">
          Try adjusting your search terms or browse categories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Found {data.count} result{data.count !== 1 ? "s" : ""} for &quot;{query}&quot;
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.results.map((product: any) => (
          <DealCard key={product.id} product={product} />
        ))}
      </div>
      {data.nextCursor && (
        <div className="flex justify-center">
          <Link
            href={`/search?q=${encodeURIComponent(query)}${category ? `&category=${category}` : ""}&cursor=${data.nextCursor}`}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Load More
          </Link>
        </div>
      )}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
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

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams?.q || "";
  const category = searchParams?.category;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">Search Deals</h1>
        <p className="mt-2 text-sm text-gray-500">
          Find price drops across AI hardware, smart gadgets, and developer software.
        </p>
      </div>

      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults query={query} category={category} cursor={searchParams?.cursor} />
      </Suspense>

      <div className="mt-8">
        <Link
          href="/"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          ← Back to all deals
        </Link>
      </div>
    </div>
  );
}
