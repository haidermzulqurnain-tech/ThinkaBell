import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";
import type { RetailerType } from "../types";

export interface IRetailerLinkClient {
  getAffiliateUrl(productId: number, retailer: RetailerType): Promise<string | null>;
  getSponsoredRetailer(productId: number): Promise<RetailerType | null>;
  recordClick(linkId: number): Promise<void>;
}

export class RetailerLinkClient implements IRetailerLinkClient {
  async getAffiliateUrl(productId: number, retailer: RetailerType): Promise<string | null> {
    try {
      const baseUrl = env.NEXT_PUBLIC_APP_URL;
      const response = await fetch(`${baseUrl}/api/retailer-links?productId=${productId}&retailer=${retailer}`);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { affiliateUrl?: string };
      return data.affiliateUrl ?? null;
    } catch (error) {
      logger.error(`[RetailerLinkClient] Error fetching affiliate URL for product ${productId}:`, error);
      return null;
    }
  }

  async getSponsoredRetailer(productId: number): Promise<RetailerType | null> {
    try {
      const baseUrl = env.NEXT_PUBLIC_APP_URL;
      const response = await fetch(`${baseUrl}/api/retailer-links/sponsored?productId=${productId}`);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { retailer?: RetailerType };
      return data.retailer ?? null;
    } catch (error) {
      logger.error(`[RetailerLinkClient] Error fetching sponsored retailer for product ${productId}:`, error);
      return null;
    }
  }

  async recordClick(linkId: number): Promise<void> {
    try {
      const baseUrl = env.NEXT_PUBLIC_APP_URL;
      await fetch(`${baseUrl}/api/retailer-links/${linkId}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      logger.error(`[RetailerLinkClient] Error recording click for link ${linkId}:`, error);
    }
  }
}

export const retailerLinkClient: IRetailerLinkClient = new RetailerLinkClient();
