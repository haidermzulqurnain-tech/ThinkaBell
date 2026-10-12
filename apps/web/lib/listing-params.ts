import { normalizeCategory, type DealsQuery, type SearchQuery } from "./catalog";

/**
 * Next.js 15 passes a repeated query parameter through as a string array
 * (`?category=a&category=b`). Only the first occurrence is honoured here,
 * which matches how server components read search params and keeps a
 * parameter array from reaching code that expects a string.
 */
export type ParsedSearchParam = string | string[] | undefined;

/** The `searchParams` shape a server component receives for a dynamic page. */
export type SearchParamsRecord = Record<string, ParsedSearchParam>;

const DEALS_SORTS = ["newest", "price_asc", "price_desc", "biggest_discount"] as const;

type DealsSort = NonNullable<DealsQuery["sort"]>;

function firstValue(param: ParsedSearchParam): string | undefined {
  if (typeof param === "string") return param;
  if (Array.isArray(param)) return param[0];
  return undefined;
}

function readString(param: ParsedSearchParam): string | undefined {
  const value = firstValue(param);
  return value === undefined || value === "" ? undefined : value;
}

function readPositiveNumber(param: ParsedSearchParam): number | undefined {
  const value = readString(param);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Turns the raw `/deals` query string into the filters the deals page and its
 * metadata agree on. An unknown category or sort value is dropped rather than
 * forwarded to the database, and `min_discount` only survives as a positive
 * finite number.
 */
export function parseDealsSearchParams(searchParams?: SearchParamsRecord): DealsQuery {
  const params = searchParams ?? {};

  return {
    category: normalizeCategory(readString(params.category)),
    deal_type: readString(params.deal_type),
    min_discount: readPositiveNumber(params.min_discount),
    sort: DEALS_SORTS.find((sort): sort is DealsSort => sort === readString(params.sort)),
    cursor: readString(params.cursor),
  };
}

/**
 * Turns the raw `/search` query string into the terms the search page and its
 * metadata agree on. Invalid category values are dropped so the cursor link
 * built from these terms cannot carry one through to a search that ignores it.
 */
export function parseSearchSearchParams(searchParams?: SearchParamsRecord): SearchQuery {
  const params = searchParams ?? {};

  return {
    q: readString(params.q),
    category: normalizeCategory(readString(params.category)),
    cursor: readString(params.cursor),
  };
}
