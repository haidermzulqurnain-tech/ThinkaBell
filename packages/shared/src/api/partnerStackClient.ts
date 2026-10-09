import { env } from "@thinkabell/config";
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

/**
 * A marketplace-listed program from the PartnerStack
 * Partner API (GET /api/v2/marketplace/programs).
 */
interface PartnerStackProgram {
  id: number;
  key: string;
  name: string;
  description: string;
  category: string[];
  country: string;
  website: string;
  logo: string;
  offers: { base_rate: string; currency: string; type_: string }[];
}

interface PartnerStackProgramsResponse {
  data: { items: PartnerStackProgram[]; has_more: boolean; total: number };
}

/**
 * PartnerStack Partner API base URL. The Partner API is
 * versioned under /api/v2 and authenticates with a
 * Bearer token (the partner API key from PartnerStack
 * user settings).
 */
const PARTNERSTACK_API_BASE = "https://api.partnerstack.com/api/v2";

/** Maximum page size accepted by the marketplace endpoint. */
const PAGE_SIZE = 250;

/**
 * Upper bound on harvested pages. The marketplace catalog
 * is paginated with a cursor; this caps the harvest so a
 * discovery run stays bounded even for large catalogs.
 */
const MAX_PAGES = 5;

class PartnerStackClient implements IPartnerStackClient {
  private apiKey: string;

  constructor() {
    this.apiKey = env.PARTNERSTACK_API_KEY || "";
  }

  private hasCredentials(): boolean {
    return Boolean(this.apiKey);
  }

  private async request<T>(path: string): Promise<T> {
    return retryWithBackoff(async () => {
      const response = await fetch(`${PARTNERSTACK_API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = new Error(`PartnerStack API error: HTTP ${response.status}`) as Error & {
          status: number;
        };
        error.status = response.status;
        throw error;
      }

      return (await response.json()) as T;
    });
  }

  async searchProducts(query: string): Promise<PartnerStackProduct[]> {
    if (!this.hasCredentials()) {
      throw new Error("PartnerStack API key is not configured");
    }

    // The marketplace endpoint has no free-text search
    // parameter — it supports category filters and cursor
    // pagination — so the harvest pages through the
    // catalog and filters by name, description, and
    // category client-side.
    const filter = query.trim().toLowerCase();
    const programs: PartnerStackProgram[] = [];
    let startingAfter: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (startingAfter) {
        params.set("starting_after", startingAfter);
      }

      const body = await this.request<PartnerStackProgramsResponse>(
        `/marketplace/programs?${params.toString()}`,
      );
      const items = body.data?.items ?? [];
      programs.push(...items);

      if (!body.data?.has_more || items.length === 0) {
        break;
      }

      startingAfter = items[items.length - 1]!.key;
    }

    return programs
      .filter((program) => {
        if (!filter) {
          return true;
        }
        return (
          program.name.toLowerCase().includes(filter) ||
          program.description.toLowerCase().includes(filter) ||
          (program.category ?? []).some((category) => category.toLowerCase().includes(filter))
        );
      })
      .map(mapProgram);
  }

  async getProductBySlug(companyKey: string): Promise<PartnerStackProduct | null> {
    if (!this.hasCredentials()) {
      throw new Error("PartnerStack API key is not configured");
    }

    try {
      const body = await this.request<{ data: PartnerStackProgram }>(
        `/marketplace/programs/${encodeURIComponent(companyKey)}`,
      );
      return body.data ? mapProgram(body.data) : null;
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }
}

function mapProgram(program: PartnerStackProgram): PartnerStackProduct {
  return {
    id: String(program.id),
    name: program.name,
    slug: program.key,
    // The marketplace listing does not publish the
    // vendor's price — SaaS pricing lives on the
    // vendor site linked below.
    price: 0,
    currency: program.offers?.[0]?.currency || "USD",
    description: program.description,
    category: (program.category ?? []).join(", "),
    vendor: program.name,
    commission_rate: Number(program.offers?.[0]?.base_rate) || 0,
    url: program.website,
    // `logo` is an image key, not a URL — do not
    // fabricate a logo URL from it.
    logo_url: undefined,
  };
}

export const partnerStackClient = new PartnerStackClient();
