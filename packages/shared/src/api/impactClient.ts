import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";
import { retryWithBackoff } from "../utils/retry";

export interface ImpactOffer {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  description: string;
  category: string;
  advertiser: string;
  commission_rate: number;
  url: string;
  images?: string[];
  logo_url?: string;
}

export interface IImpactClient {
  searchOffers(query: string): Promise<ImpactOffer[]>;
  getOfferBySlug(slug: string): Promise<ImpactOffer | null>;
}

class ImpactClient implements IImpactClient {
  private apiKey: string;
  private accountId: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = env.IMPACT_API_KEY || "";
    this.accountId = env.IMPACT_ACCOUNT_ID || "";
    this.baseUrl = "https://api.impact.com/1.0";
  }

  private hasCredentials(): boolean {
    return Boolean(this.apiKey && this.accountId);
  }

  async searchOffers(query: string): Promise<ImpactOffer[]> {
    if (!this.hasCredentials()) {
      throw new Error("Impact API key and account ID are not configured");
    }

    return retryWithBackoff(async () => {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/offers?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Impact API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.offers || [];
    });
  }

  async getOfferBySlug(slug: string): Promise<ImpactOffer | null> {
    if (!this.hasCredentials()) {
      throw new Error("Impact API key and account ID are not configured");
    }

    return retryWithBackoff(async () => {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/offers/${slug}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Impact API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.offer || null;
    });
  }
}

export const impactClient = new ImpactClient();
