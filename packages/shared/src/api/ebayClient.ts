import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";
import { retryWithBackoff } from "../utils/retry";

export interface IEbayClient {
  getPrice(epidOrItemId: string): Promise<number | null>;
  searchItems(query: string, limit?: number): Promise<EbaySearchResult[]>;
  getItemDetails(itemId: string): Promise<EbayItemDetails | null>;
}

export interface EbaySearchResult {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  category?: string;
  url: string;
}

export interface EbayItemDetails {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  images?: string[];
  description?: string;
  category?: string;
  url: string;
  seller?: string;
  shipping?: string;
  condition?: string;
}

export class EbayBrowseApiClient implements IEbayClient {
  private clientId: string;
  private clientSecret: string;
  private campaignId: string;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(clientId?: string, clientSecret?: string, campaignId?: string) {
    this.clientId = clientId || env.EBAY_CLIENT_ID;
    this.clientSecret = clientSecret || env.EBAY_CLIENT_SECRET;
    this.campaignId = campaignId || env.EBAY_AFFILIATE_CAMPAIGN_ID;
  }

  private hasCredentials(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Fetch or return cached OAuth application token (Client Credentials)
   */
  private async getAccessToken(): Promise<string | null> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.token;
    }

    if (!this.hasCredentials()) return null;

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
      const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err = new Error(`eBay OAuth error: HTTP ${res.status}: ${errorText}`) as Error & { status: number };
        err.status = res.status;
        throw err;
      }

      const data = (await res.json()) as { access_token: string; expires_in: number };
      this.cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      return this.cachedToken.token;
    } catch (err) {
      if (err instanceof Error && "status" in err) {
        throw err;
      }
      logger.error("[EbayClient] Error acquiring OAuth access token", err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async getPrice(epidOrItemId: string): Promise<number | null> {
    const token = await this.getAccessToken();

    if (!token) {
      throw new Error("eBay OAuth credentials are not configured");
    }

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      };

      if (this.campaignId) {
        headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${this.campaignId}`;
      }

      const response = await retryWithBackoff(
        () =>
          fetch(
            `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(epidOrItemId)}`,
            { headers },
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

      const data = (await response.json()) as { price?: { value?: string } };
      const val = data.price?.value;
      return val ? parseFloat(val) : null;
    } catch (error) {
      logger.error(`[EbayClient] Network error fetching ${epidOrItemId}:`, error);
      throw error;
    }
  }

  async searchItems(query: string, limit = 20): Promise<EbaySearchResult[]> {
    const token = await this.getAccessToken();

    if (!token) {
      throw new Error("eBay OAuth credentials are not configured");
    }

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      };

      if (this.campaignId) {
        headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${this.campaignId}`;
      }

      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        filter: "buyItNowOnly",
        "sort": "price+ascending",
      });

      const response = await retryWithBackoff(
        () =>
          fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
            headers,
          }).then(async (res) => {
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
        itemSummaries?: Array<{
          itemId: string;
          title: string;
          price?: { value?: string; currency?: string };
          image?: { imageUrl?: string };
          primaryCategory?: { categoryName?: string };
          itemWebUrl?: string;
        }>;
      };

      if (!data.itemSummaries) {
        return [];
      }

      return data.itemSummaries.map((item) => ({
        itemId: item.itemId,
        title: item.title,
        price: parseFloat(item.price?.value || "0"),
        currency: item.price?.currency || "USD",
        imageUrl: item.image?.imageUrl,
        category: item.primaryCategory?.categoryName,
        url: item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
      }));
    } catch (error) {
      logger.error(`[EbayClient] Search error for "${query}":`, error);
      throw error;
    }
  }

  async getItemDetails(itemId: string): Promise<EbayItemDetails | null> {
    const token = await this.getAccessToken();

    if (!token) {
      throw new Error("eBay OAuth credentials are not configured");
    }

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      };

      if (this.campaignId) {
        headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${this.campaignId}`;
      }

      const fields = [
        "title",
        "price",
        "image",
        "additionalImages",
        "description",
        "category",
        "seller",
        "shipping",
        "condition",
        "itemWebUrl",
      ].join(",");

      const response = await retryWithBackoff(
        () =>
          fetch(
            `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(itemId)}?fieldgroups=${fields}`,
            { headers },
          ).then(async (res) => {
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
        title?: string;
        price?: { value?: string; currency?: string };
        image?: { imageUrl?: string };
        additionalImages?: Array<{ imageUrl?: string }>;
        description?: string;
        primaryCategory?: { categoryName?: string };
        seller?: { username?: string };
        shippingOptions?: Array<{ shippingCost?: { value?: string }; shippingCostType?: string }>;
        condition?: string;
        itemWebUrl?: string;
      };

      const images = [data.image?.imageUrl, ...(data.additionalImages?.map((img) => img.imageUrl).filter(Boolean) || [])].filter(
        (url): url is string => Boolean(url),
      );

      const shipping = data.shippingOptions?.[0]
        ? `${data.shippingOptions[0].shippingCostType}${data.shippingOptions[0].shippingCost?.value ? ` - $${data.shippingOptions[0].shippingCost.value}` : ""}`
        : undefined;

      return {
        itemId,
        title: data.title || "",
        price: parseFloat(data.price?.value || "0"),
        currency: data.price?.currency || "USD",
        imageUrl: data.image?.imageUrl,
        images: images.length > 0 ? images : undefined,
        description: data.description,
        category: data.primaryCategory?.categoryName,
        url: data.itemWebUrl || `https://www.ebay.com/itm/${itemId}`,
        seller: data.seller?.username,
        shipping,
        condition: data.condition,
      };
    } catch (error) {
      logger.error(`[EbayClient] Error fetching item details for ${itemId}:`, error);
      throw error;
    }
  }
}

export const ebayClient: IEbayClient = new EbayBrowseApiClient();
