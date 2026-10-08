"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

interface DealFiltersProps {
  selectedCategory?: string;
  selectedDealType?: string;
  minDiscount?: number;
  sort?: string;
}

export function DealFilters({ selectedCategory, selectedDealType, minDiscount, sort }: DealFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("cursor");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Filters:</span>

          <select
            value={selectedCategory || "all"}
            onChange={(e) => updateFilter("category", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">All Categories</option>
            <option value="physical">Physical Gadgets</option>
            <option value="software">Software & SaaS</option>
          </select>

          <select
            value={selectedDealType || "all"}
            onChange={(e) => updateFilter("deal_type", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">All Deal Types</option>
            <option value="lifetime">Lifetime Deal</option>
            <option value="subscription">Subscription</option>
            <option value="bundle">Bundle</option>
            <option value="sale">Sale</option>
          </select>

          <select
            value={minDiscount || "all"}
            onChange={(e) => updateFilter("min_discount", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Any Discount</option>
            <option value="5">5%+ Off</option>
            <option value="10">10%+ Off</option>
            <option value="25">25%+ Off</option>
            <option value="50">50%+ Off</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Sort by:</span>
          <select
            value={sort || "newest"}
            onChange={(e) => updateFilter("sort", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="biggest_discount">Biggest Discount</option>
          </select>
        </div>
      </div>
    </div>
  );
}
