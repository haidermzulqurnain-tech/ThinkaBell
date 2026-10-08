import { ComparisonRepository } from "@thinkabell/database";
import type { Product } from "@thinkabell/shared";

/**
 * Shared comparison query logic.
 *
 * The /api/compare route adds rate limiting and request validation
 * (400 on bad input) before calling this; the /compare page calls
 * it directly so server renders never hit the client-facing rate
 * limiter or make an HTTP round-trip back to their own API.
 */

const MAX_COMPARE_SLUGS = 20;

export function normalizeCategory(value: string | null): "physical" | "software" | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return lower === "physical" || lower === "software"
    ? (lower as "physical" | "software")
    : null;
}

export interface CompareSearchParams {
  slugs?: string;
  category?: string;
}

export async function getCompareProducts(
  searchParams: CompareSearchParams,
): Promise<Product[]> {
  const category = normalizeCategory(searchParams?.category ?? null);
  const rawSlugs = searchParams?.slugs;

  if (rawSlugs) {
    const slugArray = rawSlugs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COMPARE_SLUGS);
    if (slugArray.length === 0) {
      return [];
    }
    return (await ComparisonRepository.getBySlugs(slugArray)) as Product[];
  }

  if (!category) {
    return [];
  }

  return (await ComparisonRepository.getComparableProducts(category, 4)) as Product[];
}
