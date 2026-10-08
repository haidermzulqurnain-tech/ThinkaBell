import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";
import { retryWithBackoff } from "../utils/retry";
import {
  AmazonAffiliateLinkError,
  buildAmazonProductUrl,
  generateAmazonAffiliateLink,
  normalizeMarketplaceCode,
} from "./amazonAffiliateLinkGenerator";
import type { DiscoveredProduct } from "./discovery";

/**
 * Amazon List harvester (manual data curation, no API, no credentials).
 *
 * The supported curation model is manual: a human curates public Amazon
 * Lists (wish lists / Listmania) in their own Amazon account and the list
 * URLs are supplied via AMAZON_LIST_URLS. This module harvests the public
 * list pages — it never authenticates to Amazon and never stores or uses
 * Amazon login credentials, which keeps the platform inside Amazon's
 * Conditions of Use for automated access.
 */

export interface AmazonListConfig {
  /** Public URL of the curated Amazon List. */
  url: string;
  /** Marketplace code for items in this list (e.g. "US", "UK"). */
  marketplace: string;
}

export interface AmazonListItem {
  asin: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
}

export class AmazonListConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmazonListConfigError";
  }
}

const ASIN_PATTERN = /^([A-Z0-9]{10})"/i;
const TITLE_SPAN_PATTERN = /<span class="a-truncate-full[^"]*"[^>]*>([^<]{2,300})<\/span>/;
const ALT_PATTERN = /alt="([^"]{2,300})"/;
const PRICE_PATTERN = /class="a-offscreen"[^>]*>\s*([£$€]\s?[\d][\d,.]*)/;
const DYNAMIC_IMAGE_PATTERN = /data-a-dynamic-image="([^"]+)"/;
const STATIC_IMAGE_PATTERN = /src="(https:\/\/m\.media-amazon\.com\/[^"]+)"/;
const IMAGE_URL_IN_DYNAMIC_PATTERN = /https:\/\/[^"\\ ]+/;

const MARKETPLACE_CURRENCY: Record<string, string> = {
  US: "USD",
  UK: "GBP",
  DE: "EUR",
  CA: "CAD",
};

function currencyForMarketplace(marketplace: string): string {
  return MARKETPLACE_CURRENCY[marketplace.toUpperCase()] ?? "USD";
}

function parsePrice(raw: string): number | null {
  const normalized = raw.replace(/[£$€,\s]/g, "");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Parses a public Amazon List page and extracts the curated items.
 * Extraction is regex-based and dependency-free; unknown page layouts
 * yield an empty list rather than throwing.
 */
export function parseAmazonListHtml(html: string): AmazonListItem[] {
  const items: AmazonListItem[] = [];
  const seen = new Set<string>();
  const chunks = html.split('data-asin="');

  for (const chunk of chunks.slice(1)) {
    const asinMatch = chunk.match(ASIN_PATTERN);
    if (!asinMatch) {
      continue;
    }

    const asin = asinMatch[1]!.toUpperCase();
    if (seen.has(asin)) {
      continue;
    }

    const spanTitle = chunk.match(TITLE_SPAN_PATTERN)?.[1];
    const altTitle = chunk.match(ALT_PATTERN)?.[1];
    const title = decodeEntities((spanTitle ?? altTitle ?? "").trim());
    if (!title) {
      continue;
    }

    const priceMatch = chunk.match(PRICE_PATTERN);
    const price = priceMatch ? parsePrice(priceMatch[1]!) : null;

    const dynamicImage = chunk.match(DYNAMIC_IMAGE_PATTERN)?.[1] ?? "";
    const imageUrl =
      (dynamicImage.match(IMAGE_URL_IN_DYNAMIC_PATTERN)?.[0] ??
        chunk.match(STATIC_IMAGE_PATTERN)?.[1] ??
        null);

    seen.add(asin);
    items.push({
      asin,
      title,
      price,
      imageUrl,
    });
  }

  return items;
}

/**
 * Parses the AMAZON_LIST_URLS environment variable.
 *
 * @throws AmazonListConfigError when the value is malformed JSON.
 *         Returns an empty array when unset (source not configured).
 */
export function getAmazonListConfigs(): AmazonListConfig[] {
  const raw = env.AMAZON_LIST_URLS;
  if (!raw.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AmazonListConfigError(
      "AMAZON_LIST_URLS must be a JSON array of { url, marketplace } entries",
    );
  }

  if (!Array.isArray(parsed)) {
    throw new AmazonListConfigError("AMAZON_LIST_URLS must be a JSON array");
  }

  return parsed
    .filter((entry): entry is { url: string; marketplace?: string } => {
      if (typeof entry !== "object" || entry === null) {
        return false;
      }
      const candidate = entry as { url?: unknown; marketplace?: unknown };
      return typeof candidate.url === "string" && candidate.url.trim() !== "";
    })
    .map((entry) => ({
      url: entry.url,
      marketplace: normalizeMarketplaceCode(
        typeof entry.marketplace === "string" ? entry.marketplace : env.AMAZON_LIST_MARKETPLACE,
      ),
    }));
}

const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ThinkaBellDealResearch/1.0; +https://thinkabell.click)";

async function fetchWithTimeout(url: string): Promise<string> {
  const response = await retryWithBackoff(
    () =>
      fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      }).then(async (res) => {
        if (!res.ok) {
          const error = new Error(`HTTP ${res.status}`) as Error & { status: number };
          error.status = res.status;
          throw error;
        }
        return res.text();
      }),
    { maxAttempts: 3, retryableStatuses: [429, 500, 502, 503, 504] },
  );

  return response;
}

export class AmazonListClient {
  /**
   * Harvests a single public Amazon List and maps every item to a
   * DiscoveredProduct, including affiliate links generated by the
   * modular link generator.
   */
  async fetchListItems(config: AmazonListConfig): Promise<DiscoveredProduct[]> {
    const html = await fetchWithTimeout(config.url);
    const maxItems = env.AMAZON_LIST_MAX_ITEMS;
    const rawItems = parseAmazonListHtml(html).slice(0, Math.max(0, maxItems));
    const currency = currencyForMarketplace(config.marketplace);

    const products: DiscoveredProduct[] = [];

    for (const item of rawItems) {
      const plainUrl = buildAmazonProductUrl(item.asin, config.marketplace);

      let affiliateUrl: string | undefined;
      try {
        affiliateUrl = generateAmazonAffiliateLink(item.asin, config.marketplace);
      } catch (error) {
        if (error instanceof AmazonAffiliateLinkError) {
          // Fail closed: never emit an untagged or placeholder affiliate
          // link. The product is still harvested with its plain URL so it
          // remains available for deal comparison.
          logger.warn(
            `[AmazonListClient] No affiliate tag configured for ${config.marketplace}; skipping affiliate link for ASIN ${item.asin}`,
          );
          affiliateUrl = undefined;
        } else {
          throw error;
        }
      }

      products.push({
        sourceId: item.asin,
        source: "amazon-list",
        amazonAsin: item.asin,
        name: item.title,
        description: item.title,
        price: item.price ?? 0,
        currency,
        imageUrl: item.imageUrl ?? undefined,
        category: "physical",
        url: plainUrl,
        affiliateUrl,
        metadata: {
          marketplace: config.marketplace,
          listUrl: config.url,
          affiliateTagConfigured: Boolean(affiliateUrl),
        },
      });
    }

    return products;
  }
}
