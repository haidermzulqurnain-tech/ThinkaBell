import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";
import { retryWithBackoff } from "../utils/retry";

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
  expiresAt?: string;
}

export interface IAppSumoClient {
  searchDeals(query: string): Promise<AppSumoDeal[]>;
  getDealBySlug(slug: string): Promise<AppSumoDeal | null>;
}

class AppSumoClient implements IAppSumoClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = env.APPSUMO_API_KEY || "";
    this.baseUrl = "https://api.appsumo.com/v2";
  }

  private hasCredentials(): boolean {
    return Boolean(this.apiKey);
  }

  async searchDeals(query: string): Promise<AppSumoDeal[]> {
    if (!this.hasCredentials()) {
      throw new Error("AppSumo API key is not configured");
    }

    return retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}/deals?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`AppSumo API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.deals || [];
    });
  }

  async getDealBySlug(slug: string): Promise<AppSumoDeal | null> {
    if (!this.hasCredentials()) {
      throw new Error("AppSumo API key is not configured");
    }

    return retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}/deals/${slug}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`AppSumo API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.deal || null;
    });
  }
}

export const appSumoClient = new AppSumoClient();
