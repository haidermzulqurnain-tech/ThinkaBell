import { getSupabaseAnonClient } from "@thinkabell/database";
import { encodeCursor, decodeCursor } from "@thinkabell/shared";

/**
 * Thrown when a product query fails at the data layer. API routes
 * map this to a specific 500 response rather than the generic
 * "Internal server error" reserved for unexpected failures.
 */
export class CatalogQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogQueryError";
  }
}

/**
 * Shared product query logic for the deals/search listings.
 *
 * Both the public API routes (/api/deals, /api/search — which add rate
 * limiting and shape the HTTP response) and the server-rendered pages
 * (/deals, /search — which must NOT go through the client-facing rate
 * limiter) call these functions directly instead of the pages making an
 * HTTP round-trip back to their own API.
 */

export function normalizeCategory(value: unknown): "physical" | "software" | undefined {
  if (typeof value !== "string") return undefined;
  const lower = value.toLowerCase();
  if (lower === "physical" || lower === "software") {
    return lower as "physical" | "software";
  }
  return undefined;
}

export interface DealItem {
  id: number;
  name: string;
  slug: string;
  category: string;
  brand: string | null;
  current_price: number | null;
  previous_price: number | null;
  discount_percent: number;
  image_url: string | null;
  description: string | null;
  tags: string[];
  price_updated_at: string | null;
  deal_type?: string | null;
  promo_code?: string | null;
  deal_end_date?: string | null;
}

export interface SearchQuery {
  q?: string;
  category?: "physical" | "software";
  deal_type?: string;
  min_discount?: number;
  cursor?: string;
}

export interface SearchResponse {
  count: number;
  results: DealItem[];
  nextCursor: string | null;
}

const SEARCH_LIMIT = 24;

export async function searchProducts(query: SearchQuery): Promise<SearchResponse> {
  let dbQuery = getSupabaseAnonClient()
    .from("products")
    .select("id, name, slug, category, brand, current_price, previous_price, image_url, description, tags, price_updated_at")
    .eq("is_active", true);

  if (query.category) {
    dbQuery = dbQuery.eq("category", query.category);
  }

  if (query.deal_type) {
    dbQuery = dbQuery.eq("deal_type", query.deal_type);
  }

  if (query.min_discount && Number.isFinite(query.min_discount)) {
    dbQuery = dbQuery.gte("discount_percent", query.min_discount);
  }

  if (query.q) {
    dbQuery = dbQuery.textSearch("search_vector", query.q, { type: "websearch" });
  }

  const decodedCursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (decodedCursor?.id && decodedCursor?.created_at) {
    dbQuery = dbQuery.lt("price_updated_at", decodedCursor.created_at as string);
  }

  dbQuery = dbQuery.order("price_updated_at", { ascending: false }).limit(SEARCH_LIMIT + 1);

  const { data, error } = await dbQuery;

  if (error) {
    console.error("[Search] Error querying products:", error);
    throw new CatalogQueryError("Search failed");
  }

  const hasMore = (data ?? []).length > SEARCH_LIMIT;
  const items = hasMore ? (data ?? []).slice(0, SEARCH_LIMIT) : (data ?? []);
  const lastItem = items[items.length - 1];
  const nextCursor = lastItem
    ? encodeCursor({ id: lastItem.id, created_at: lastItem.price_updated_at })
    : null;

  const results: DealItem[] = items.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    brand: product.brand,
    current_price: product.current_price,
    previous_price: product.previous_price,
    discount_percent:
      product.previous_price && product.current_price
        ? Number((((product.previous_price - product.current_price) / product.previous_price) * 100).toFixed(2))
        : 0,
    image_url: product.image_url,
    description: product.description,
    tags: product.tags,
    price_updated_at: product.price_updated_at,
  }));

  return { count: results.length, results, nextCursor };
}

export interface DealsQuery {
  category?: "physical" | "software";
  deal_type?: string;
  min_discount?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "biggest_discount";
  cursor?: string;
  limit?: number;
}

export interface DealsResponse {
  count: number;
  results: DealItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

const DEALS_DEFAULT_LIMIT = 24;
const DEALS_MAX_LIMIT = 48;

export async function fetchDeals(query: DealsQuery): Promise<DealsResponse> {
  const rawLimit = query.limit ?? DEALS_DEFAULT_LIMIT;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, DEALS_MAX_LIMIT) : DEALS_DEFAULT_LIMIT;

  let dbQuery = getSupabaseAnonClient()
    .from("products")
    .select("id, name, slug, category, brand, current_price, previous_price, image_url, description, tags, price_updated_at, deal_type, promo_code, deal_end_date")
    .eq("is_active", true);

  if (query.category) {
    dbQuery = dbQuery.eq("category", query.category);
  }

  if (query.deal_type) {
    dbQuery = dbQuery.eq("deal_type", query.deal_type);
  }

  if (query.min_discount && Number.isFinite(query.min_discount) && query.min_discount > 0) {
    dbQuery = dbQuery.gte("discount_percent", query.min_discount);
  }

  switch (query.sort) {
    case "price_asc":
      dbQuery = dbQuery.order("current_price", { ascending: true });
      break;
    case "price_desc":
      dbQuery = dbQuery.order("current_price", { ascending: false });
      break;
    case "biggest_discount":
      dbQuery = dbQuery.order("discount_percent", { ascending: false });
      break;
    case "newest":
    default:
      dbQuery = dbQuery.order("price_updated_at", { ascending: false });
      break;
  }

  const decodedCursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (decodedCursor?.id && decodedCursor?.created_at) {
    dbQuery = dbQuery.lt("price_updated_at", decodedCursor.created_at as string);
  }

  dbQuery = dbQuery.limit(limit + 1);

  const { data, error } = await dbQuery;

  if (error) {
    console.error("[Deals] Error querying products:", error);
    throw new CatalogQueryError("Failed to fetch deals");
  }

  const hasMore = (data ?? []).length > limit;
  const items = hasMore ? (data ?? []).slice(0, limit) : (data ?? []);
  const lastItem = items[items.length - 1];
  const nextCursor = lastItem
    ? encodeCursor({ id: lastItem.id, created_at: lastItem.price_updated_at })
    : null;

  const results: DealItem[] = items.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    brand: product.brand,
    current_price: product.current_price,
    previous_price: product.previous_price,
    discount_percent:
      product.previous_price && product.current_price
        ? Number((((product.previous_price - product.current_price) / product.previous_price) * 100).toFixed(2))
        : 0,
    image_url: product.image_url,
    description: product.description,
    tags: product.tags,
    price_updated_at: product.price_updated_at,
    deal_type: product.deal_type,
    promo_code: product.promo_code,
    deal_end_date: product.deal_end_date,
  }));

  return { count: results.length, results, nextCursor, hasMore };
}
