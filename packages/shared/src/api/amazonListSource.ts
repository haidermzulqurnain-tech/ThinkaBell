import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";
import { AmazonListClient, getAmazonListConfigs } from "./amazonListClient";
import type { DiscoveredProduct, ProductSource } from "./discovery";

/**
 * ProductSource implementation backed by manually curated public
 * Amazon Lists. Search harvests every configured list; an optional
 * query narrows results by case-insensitive title match.
 */
export class AmazonListSource implements ProductSource {
  readonly name = "amazon-list";
  readonly type: "physical" | "software" = "physical";

  constructor(private readonly client: AmazonListClient = new AmazonListClient()) {}

  async search(query = ""): Promise<DiscoveredProduct[]> {
    const configs = getAmazonListConfigs();
    const products: DiscoveredProduct[] = [];
    const seen = new Set<string>();
    const filter = query.trim().toLowerCase();

    for (const config of configs) {
      try {
        const items = await this.client.fetchListItems(config);

        for (const item of items) {
          if (seen.has(item.sourceId)) {
            continue;
          }
          if (filter && !item.name.toLowerCase().includes(filter)) {
            continue;
          }
          seen.add(item.sourceId);
          products.push(item);
        }
      } catch (error) {
        // One unreachable list must not abort the harvest of the
        // remaining curated lists; the failure is logged and the
        // run continues with the next list.
        logger.error(`[AmazonListSource] Failed to harvest list ${config.url}:`, error);
      }

      // Polite rate limiting between consecutive list fetches.
      if (env.AMAZON_LIST_FETCH_DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, env.AMAZON_LIST_FETCH_DELAY_MS));
      }
    }

    return products;
  }

  /**
   * Re-harvests the curated lists to resolve the freshest price
   * for an ASIN. No PA-API credentials are required.
   */
  async getPrice(sourceId: string): Promise<number | null> {
    const product = await this.findProduct(sourceId);
    return product && product.price > 0 ? product.price : null;
  }

  async getProductDetails(sourceId: string): Promise<DiscoveredProduct | null> {
    return this.findProduct(sourceId);
  }

  private async findProduct(sourceId: string): Promise<DiscoveredProduct | null> {
    const configs = getAmazonListConfigs();

    for (const config of configs) {
      try {
        const items = await this.client.fetchListItems(config);
        const match = items.find((item) => item.sourceId === sourceId);
        if (match) {
          return match;
        }
      } catch (error) {
        logger.error(`[AmazonListSource] Failed to harvest list ${config.url}:`, error);
      }
    }

    return null;
  }
}
