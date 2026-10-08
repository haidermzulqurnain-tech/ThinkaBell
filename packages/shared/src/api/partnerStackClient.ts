import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";
import { retryWithBackoff } from "../utils/retry";

export interface PartnerStackProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  description: string;
  category: string;
  vendor: string;
  commission_rate: number;
  url: string;
  images?: string[];
  logo_url?: string;
}

export interface IPartnerStackClient {
  searchProducts(query: string): Promise<PartnerStackProduct[]>;
  getProductBySlug(slug: string): Promise<PartnerStackProduct | null>;
}

class PartnerStackClient implements IPartnerStackClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = env.PARTNERSTACK_API_KEY || "";
    this.baseUrl = "https://api.partnerstack.com/1.0";
  }

  private hasCredentials(): boolean {
    return Boolean(this.apiKey);
  }

  async searchProducts(query: string): Promise<PartnerStackProduct[]> {
    if (!this.hasCredentials()) {
      throw new Error("PartnerStack API key is not configured");
    }

    return retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}/products?query=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`PartnerStack API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.products || [];
    });
  }

  async getProductBySlug(slug: string): Promise<PartnerStackProduct | null> {
    if (!this.hasCredentials()) {
      throw new Error("PartnerStack API key is not configured");
    }

    return retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}/products/${slug}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`PartnerStack API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.product || null;
    });
  }
}

export const partnerStackClient = new PartnerStackClient();
