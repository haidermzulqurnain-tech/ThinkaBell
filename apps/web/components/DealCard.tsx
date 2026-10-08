"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, TrendingDown } from "lucide-react";
import type { Product } from "@thinkabell/shared";
import { trackEvent } from "../lib/posthog";
import { CompareToggle } from "./CompareToggle";
import { fallbackImageUrl } from "../lib/fallbackImages";

interface DealCardProps {
  product: Product;
}

export function DealCard({ product }: DealCardProps) {
  const currentPrice = product.current_price ?? 0;
  const previousPrice = product.previous_price ?? currentPrice;
  const hasDiscount = previousPrice > currentPrice && currentPrice > 0;
  const discountPercent = hasDiscount
    ? Math.round(((previousPrice - currentPrice) / previousPrice) * 100)
    : 0;

  const fallbackImage = fallbackImageUrl(product.category);

  const handleCardClick = () => {
    trackEvent("deal_card_click", {
      slug: product.slug,
      name: product.name,
      category: product.category,
      discountPercent,
      currentPrice,
    });
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200">
      {/* Discount Badge */}
      {discountPercent >= 5 && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
          <TrendingDown className="h-3.5 w-3.5" />
          <span>{discountPercent}% OFF</span>
        </div>
      )}

      {/* Category Tag */}
      <div className="absolute right-3 top-3 z-10 rounded-full bg-gray-900/80 backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium text-white capitalize">
        {product.category}
      </div>

      {/* Product Image */}
      <Link
        href={`/deal/${product.slug}`}
        onClick={handleCardClick}
        className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100"
      >
        <Image
          src={product.image_url || fallbackImage}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      {/* Product Details */}
      <div className="flex flex-1 flex-col p-5">
        {product.brand && (
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            {product.brand}
          </p>
        )}

        <h3 className="text-base font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
          <Link href={`/deal/${product.slug}`} onClick={handleCardClick}>
            {product.name}
          </Link>
        </h3>

        <p className="mt-2 text-xs text-gray-500 line-clamp-2">
          {product.description || "Track real-time price updates and historic discounts."}
        </p>

        {/* Pricing Block */}
        <div className="mt-auto pt-4 flex items-end justify-between border-t border-gray-100">
          <div>
            {hasDiscount && (
              <p className="text-xs text-gray-500 line-through">
                ${previousPrice.toFixed(2)}
              </p>
            )}
            <p className="text-xl font-extrabold text-gray-900">
              ${currentPrice.toFixed(2)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <CompareToggle slug={product.slug} name={product.name} />
          </div>

          <Link
            href={`/deal/${product.slug}`}
            onClick={handleCardClick}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors min-h-[44px]"
          >
            <span>View Deal</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
