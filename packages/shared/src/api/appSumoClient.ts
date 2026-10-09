import { logger } from "../utils/logger";
import { fetchPublicPage } from "../utils/publicPageFetch";

export interface AppSumoDeal {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number;
  currency: string;
  description: string;
  category: string;
  vendor: string;
  commission_rate: number;
  url: string;
  images?: string[];
  imageUrl?: string;
  expiresAt?: string;
}

export interface IAppSumoClient {
  searchDeals(query: string): Promise<AppSumoDeal[]>;
  getDealBySlug(slug: string): Promise<AppSumoDeal | null>;
}

/**
 * A deal as embedded in an AppSumo page's
 * __NEXT_DATA__ payload.
 */
interface AppSumoBrowseDeal {
  id: number;
  public_name: string;
  card_description: string;
  slug: string;
  get_absolute_url: string;
  product_logo: string;
  featured_image_url: string;
  media_url: string;
  price: number;
  original_price: number;
  is_free: boolean;
  product_tags: string[];
  taxonomy?: {
    category?: { search_values?: string[] };
    subcategory?: { search_values?: string[] };
  };
  dates?: { start_date: string | null; end_date: string | null };
  has_started: boolean;
  has_ended: boolean;
  browse_deal_status: string;
}

interface AppSumoNextData {
  props?: {
    pageProps?: {
      fallbackData?: { deals?: AppSumoBrowseDeal[] }[];
      deal?: AppSumoBrowseDeal;
    };
  };
}

/**
 * AppSumo publishes no public deals API — the only
 * official API is the vendor-facing Licensing API.
 * The browse and product pages are server-rendered
 * with their deal catalog embedded in __NEXT_DATA__
 * JSON, so this client harvests those public pages:
 * no credentials, no login, polite rate limiting.
 *
 * The browse endpoint filters server-side via the
 * `query` parameter and returns the top 20 matches
 * (the remaining pages paginate client-side in the
 * browser, which is not harvestable server-side).
 */
const APPSUMO_BROWSE_URL = "https://appsumo.com/browse/";
const APPSUMO_PRODUCT_URL = "https://appsumo.com/products/";

/** AppSumo lists every deal in USD. */
const APPSUMO_CURRENCY = "USD";

class AppSumoClient implements IAppSumoClient {
  async searchDeals(query: string): Promise<AppSumoDeal[]> {
    const filter = query.trim();
    const url = filter
      ? `${APPSUMO_BROWSE_URL}?query=${encodeURIComponent(filter)}`
      : APPSUMO_BROWSE_URL;

    const html = await fetchPublicPage(url);
    return parseAppSumoDeals(html).map(mapDeal);
  }

  async getDealBySlug(slug: string): Promise<AppSumoDeal | null> {
    const html = await fetchPublicPage(`${APPSUMO_PRODUCT_URL}${encodeURIComponent(slug)}/`);

    const deal = parseAppSumoProductPage(html);
    return deal ? mapDeal(deal) : null;
  }
}

/**
 * Extracts the deal catalog from a page's
 * __NEXT_DATA__ script tag. Returns an empty
 * array when the payload is absent or malformed
 * — a page-shape change must degrade to "no
 * deals", never to a thrown error mid-harvest.
 */
export function parseAppSumoDeals(html: string): AppSumoBrowseDeal[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    return [];
  }

  let nextData: AppSumoNextData;
  try {
    nextData = JSON.parse(match[1]!) as AppSumoNextData;
  } catch {
    logger.warn("[AppSumoClient] Failed to parse __NEXT_DATA__ JSON");
    return [];
  }

  const fallbackData = nextData.props?.pageProps?.fallbackData ?? [];
  const deals: AppSumoBrowseDeal[] = [];
  const seen = new Set<number>();

  for (const entry of fallbackData) {
    for (const deal of entry.deals ?? []) {
      if (seen.has(deal.id)) {
        continue;
      }
      seen.add(deal.id);
      deals.push(deal);
    }
  }

  return deals;
}

/**
 * Extracts the single deal from a product page's
 * __NEXT_DATA__ payload (props.pageProps.deal).
 */
export function parseAppSumoProductPage(html: string): AppSumoBrowseDeal | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    return null;
  }

  let nextData: AppSumoNextData;
  try {
    nextData = JSON.parse(match[1]!) as AppSumoNextData;
  } catch {
    logger.warn("[AppSumoClient] Failed to parse __NEXT_DATA__ JSON");
    return null;
  }

  return nextData.props?.pageProps?.deal ?? null;
}

function mapDeal(deal: AppSumoBrowseDeal): AppSumoDeal {
  const category =
    deal.taxonomy?.category?.search_values?.[0] ?? (deal.product_tags ?? []).join(", ");

  return {
    id: String(deal.id),
    name: deal.public_name,
    slug: deal.slug,
    price: deal.is_free ? 0 : deal.price,
    originalPrice: deal.original_price,
    currency: APPSUMO_CURRENCY,
    description: deal.card_description,
    category,
    // The public browse payload does not include
    // the vendor name or the affiliate commission
    // rate — both are private to AppSumo's
    // affiliate program.
    vendor: "",
    commission_rate: 0,
    url: `https://appsumo.com${deal.get_absolute_url}`,
    images: [deal.featured_image_url, deal.media_url].filter(Boolean),
    imageUrl: deal.product_logo || deal.featured_image_url || undefined,
    expiresAt: deal.dates?.end_date ?? undefined,
  };
}

export const appSumoClient = new AppSumoClient();
