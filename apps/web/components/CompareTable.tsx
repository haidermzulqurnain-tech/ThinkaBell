"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Trophy, X } from "lucide-react";
import type { Product } from "@thinkabell/shared";
import { trackEvent } from "../lib/posthog";
import { fallbackImageUrl } from "../lib/fallbackImages";

interface CompareTableProps {
  products: Product[];
}

function formatPrice(price: number | null | undefined): string {
  return typeof price === "number" ? `$${price.toFixed(2)}` : "—";
}

function discountPercent(product: Product): number | null {
  const current = product.current_price;
  const previous = product.previous_price;
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    previous <= current ||
    current <= 0
  ) {
    return null;
  }
  return Math.round(((previous - current) / previous) * 100);
}

export function CompareTable({ products }: CompareTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const prices = products
    .map((p) => p.current_price)
    .filter((price): price is number => typeof price === "number");
  const bestPrice = prices.length > 0 ? Math.min(...prices) : null;

  const removeProduct = (slug: string) => {
    const remaining = products
      .filter((p) => p.slug !== slug)
      .map((p) => p.slug);

    trackEvent("compare_remove_product", {
      slug,
      remainingCount: remaining.length,
    });

    if (remaining.length === 0) {
      router.push("/deals");
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set("slugs", remaining.join(","));
    params.delete("category");
    router.replace(`/compare?${params.toString()}`);
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="w-40 p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Feature
            </th>
            {products.map((product) => (
              <th key={product.id} className="p-4 text-left align-top">
                <div className="relative group">
                  <Link
                    href={`/deal/${product.slug}`}
                    className="block"
                  >
                    <div className="relative h-32 w-full overflow-hidden rounded-xl bg-gray-100">
                      <Image
                        src={product.image_url || fallbackImageUrl(product.category)}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 200px"
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeProduct(product.slug)}
                    aria-label={`Remove ${product.name} from comparison`}
                    className="absolute -top-2 -right-2 rounded-full bg-gray-900 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 focus:opacity-100 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="Brand">
            {products.map((p) => (
              <Cell key={p.id}>{p.brand || "—"}</Cell>
            ))}
          </Row>

          <Row label="Current Price" highlight>
            {products.map((p) => {
              const isBest =
                bestPrice !== null &&
                typeof p.current_price === "number" &&
                p.current_price === bestPrice &&
                products.filter(
                  (other) => other.current_price === bestPrice,
                ).length === 1;
              return (
                <Cell key={p.id} highlight>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-lg font-extrabold text-gray-900">
                      {formatPrice(p.current_price)}
                    </span>
                    {isBest && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        <Trophy className="h-3 w-3" />
                        Best
                      </span>
                    )}
                  </span>
                </Cell>
              );
            })}
          </Row>

          <Row label="Previous Price">
            {products.map((p) => (
              <Cell key={p.id}>
                <span className="text-gray-500 line-through">
                  {formatPrice(p.previous_price)}
                </span>
              </Cell>
            ))}
          </Row>

          <Row label="Discount">
            {products.map((p) => {
              const pct = discountPercent(p);
              return (
                <Cell key={p.id}>
                  {pct !== null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                      {pct}% OFF
                    </span>
                  ) : (
                    "—"
                  )}
                </Cell>
              );
            })}
          </Row>

          <Row label="Category">
            {products.map((p) => (
              <Cell key={p.id}>
                <span className="capitalize">{p.category}</span>
              </Cell>
            ))}
          </Row>

          <Row label="Deal Type">
            {products.map((p) => (
              <Cell key={p.id}>{p.deal_type || "—"}</Cell>
            ))}
          </Row>

          <Row label="Tags">
            {products.map((p) => (
              <Cell key={p.id}>
                <div className="flex flex-wrap gap-1">
                  {(p.tags ?? []).slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Cell>
            ))}
          </Row>

          <Row label="Deal Link">
            {products.map((p) => (
              <Cell key={p.id}>
                <Link
                  href={`/deal/${p.slug}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors"
                >
                  View Deal
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Cell>
            ))}
          </Row>
        </tbody>
      </table>
    </div>
  );
}

function Row({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr
      className={
        highlight
          ? "border-b border-gray-100 bg-emerald-50/40"
          : "border-b border-gray-100"
      }
    >
      <td className="p-4 text-sm font-medium text-gray-500">{label}</td>
      {children}
    </tr>
  );
}

function Cell({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <td className={highlight ? "p-4" : "p-4 text-sm text-gray-900"}>
      {children}
    </td>
  );
}