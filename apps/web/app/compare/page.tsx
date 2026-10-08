import Link from "next/link";
import { CompareTable } from "@/components/CompareTable";
import { getNonce } from "@/lib/csp";
import { getCompareProducts } from "@/lib/compare";
import { Scale } from "lucide-react";
import type { Metadata } from "next";
import type { Product } from "@thinkabell/shared";

interface ComparePageProps {
  searchParams?: {
    slugs?: string;
    category?: string;
  };
}

async function fetchCompareProducts(
  searchParams: ComparePageProps["searchParams"],
): Promise<Product[]> {
  try {
    return await getCompareProducts({
      slugs: searchParams?.slugs,
      category: searchParams?.category,
    });
  } catch {
    return [];
  }
}

export async function generateMetadata({
  searchParams,
}: ComparePageProps): Promise<Metadata> {
  const products = await fetchCompareProducts(searchParams);
  const names = products
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ");

  return {
    title: names
      ? `Compare: ${names} | ThinkaBell`
      : "Compare Products | ThinkaBell",
    description:
      "Compare prices, discounts, and features side-by-side across tracked products and make the best buying decision.",
    alternates: { canonical: "/compare" },
    robots: products.length > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const nonce = await getNonce();
  const products = await fetchCompareProducts(searchParams);

  const comparisonJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Product Comparison",
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
        ...(typeof p.current_price === "number"
          ? {
              offers: {
                "@type": "Offer",
                price: p.current_price.toFixed(2),
                priceCurrency: "USD",
              },
            }
          : {}),
      },
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(comparisonJsonLd) }}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Compare Products
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          View prices, discounts, and details side-by-side to pick the best
          deal.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <Scale className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-4 text-lg font-bold text-gray-900">
            Nothing to compare yet
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Select{" "}
            <span className="font-medium">Compare</span> on up to four deal
            cards to compare them side-by-side, or open a category comparison
            directly.
          </p>
          <Link
            href="/deals"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Browse Deals
          </Link>
        </div>
      ) : (
        <CompareTable products={products} />
      )}
    </div>
  );
}