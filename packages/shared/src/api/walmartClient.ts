/**
 * @file packages/shared/src/api/walmartClient.ts
 * @description Walmart API client for price tracking
 */

import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";
import { retryWithBackoff } from "../utils/retry";

export interface IWalmartClient {
  getItemPrice(itemId: string): Promise<number | null>;
  searchItems(query: string, limit?: number): Promise<Array<{ id: string; name: string; price: number; imageUrl?: string }>>;
  getItemDetails(itemId: string): Promise<{
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    images?: string[];
    description?: string;
    url: string;
    brand?: string;
    category?: string;
  } | null>;
}

class WalmartApiClient implements IWalmartClient {
  private apiKey: string;
  private affiliateId: string;
  private affiliateTrackId: string;

  constructor() {
    this.apiKey = env.WALMART_API_KEY;
    this.affiliateId = env.WALMART_AFFILIATE_ID;
    this.affiliateTrackId = env.WALMART_AFFILIATE_TRACK_ID;
  }

  private hasCredentials(): boolean {
    return Boolean(this.apiKey);
  }

  async getItemPrice(itemId: string): Promise<number | null> {
    if (!this.hasCredentials()) {
      throw new Error("Walmart API key is not configured");
    }

    try {
      const response = await retryWithBackoff(
        () =>
          fetch(
            `https://api.walmart.com/api/v1/item/${encodeURIComponent(itemId)}`,
            {
              headers: {
                "X-RapidAPI-Key": this.apiKey,
                "Content-Type": "application/json",
              },
            },
          ).then(async (res) => {
            if (!res.ok) {
              const err = new Error(`HTTP ${res.status}`) as Error & { status: number };
              err.status = res.status;
              throw err;
            }
            return res;
          }),
        {
          maxAttempts: 3,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
      );

      const data = (await response.json()) as {
        price?: number;
        salePrice?: number;
      };

      const price = data.salePrice || data.price;
      return typeof price === "number" ? price : null;
    } catch (error) {
      logger.error(`[WalmartClient] Error fetching item ${itemId}:`, error);
      throw error;
    }
  }

  async searchItems(
    query: string,
    limit = 10,
  ): Promise<Array<{ id: string; name: string; price: number; imageUrl?: string }>> {
    if (!this.hasCredentials()) {
      throw new Error("Walmart API key is not configured");
    }

    try {
      const params = new URLSearchParams({
        query,
        num: String(limit),
      });

      const response = await retryWithBackoff(
        () =>
          fetch(
            `https://api.walmart.com/api/v1/search?${params}`,
            {
              headers: {
                "X-RapidAPI-Key": this.apiKey,
              },
            },
          ).then(async (res) => {
            if (!res.ok) {
              const err = new Error(`HTTP ${res.status}`) as Error & { status: number };
              err.status = res.status;
              throw err;
            }
            return res;
          }),
        {
          maxAttempts: 3,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
      );

      const data = (await response.json()) as {
        items?: Array<{ id: string; name: string; price: number; imageUrl?: string }>;
      };

      return (data.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
      }));
    } catch (error) {
      logger.error(`[WalmartClient] Search error for "${query}":`, error);
      throw error;
    }
  }

  async getItemDetails(
    itemId: string,
  ): Promise<{
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    images?: string[];
    description?: string;
    url: string;
    brand?: string;
    category?: string;
  } | null> {
    if (!this.hasCredentials()) {
      throw new Error("Walmart API key is not configured");
    }

    try {
      const response = await retryWithBackoff(
        () =>
          fetch(`https://api.walmart.com/api/v1/item/${encodeURIComponent(itemId)}`, {
            headers: {
              "X-RapidAPI-Key": this.apiKey,
              "Content-Type": "application/json",
            },
          }).then(async (res) => {
            if (!res.ok) {
              if (res.status === 404) return null;
              const err = new Error(`HTTP ${res.status}`) as Error & { status: number };
              err.status = res.status;
              throw err;
            }
            return res;
          }),
        {
          maxAttempts: 3,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
      );

      if (!response) {
        return null;
      }

      const data = (await response.json()) as {
        id: string;
        name: string;
        price?: number;
        salePrice?: number;
        imageUrl?: string;
        images?: string[];
        description?: string;
        productUrl?: string;
        brand?: string;
        category?: string;
      };

      const price = data.salePrice || data.price;
      const images = data.images?.length ? data.images : data.imageUrl ? [data.imageUrl] : [];

      return {
        id: data.id,
        name: data.name,
        price: typeof price === "number" ? price : 0,
        imageUrl: data.imageUrl,
        images: images.length > 0 ? images : undefined,
        description: data.description,
        url: data.productUrl || `https://walmart.com/ip/${data.id}`,
        brand: data.brand,
        category: data.category,
      };
    } catch (error) {
      logger.error(`[WalmartClient] Error fetching item details for ${itemId}:`, error);
      throw error;
    }
  }
}

export const walmartClient: IWalmartClient = new WalmartApiClient();