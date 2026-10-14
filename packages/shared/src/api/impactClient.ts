import { env } from "@thinkabell/config";
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
  /**
   * Impact-tracked affiliate link for the campaign,
   * when the API exposes one. Prefer this over the
   * plain campaign URL for outbound clicks.
   */
  trackingLink?: string;
  images?: string[];
  logo_url?: string;
}

export interface IImpactClient {
  searchOffers(query: string): Promise<ImpactOffer[]>;
  getOfferBySlug(slug: string): Promise<ImpactOffer | null>;
}

/**
 * A campaign (affiliate program) from the Impact
 * Partner API. Impact's REST API uses PascalCase
 * field names.
 */
interface ImpactCampaign {
  AdvertiserId: string;
  AdvertiserName: string;
  AdvertiserUrl: string;
  CampaignId: string;
  CampaignName: string;
  CampaignUrl: string;
  CampaignDescription: string;
  Type: string;
  CampaignLogoUri: string;
  ContractStatus: string;
  TrackingLink: string;
  Uri: string;
}

interface ImpactCampaignsResponse {
  Campaigns: ImpactCampaign[];
}

/**
 * Impact REST API base URL. The Partner API
 * authenticates with HTTP Basic: the Account SID
 * is the username and the Auth Token is the
 * password.
 */
const IMPACT_API_BASE = "https://api.impact.com";

class ImpactClient implements IImpactClient {
  private accountSid: string;
  private authToken: string;

  constructor() {
    this.accountSid = env.IMPACT_ACCOUNT_SID || "";
    this.authToken = env.IMPACT_AUTH_TOKEN || "";
  }

  private hasCredentials(): boolean {
    return Boolean(this.accountSid && this.authToken);
  }

  private async request<T>(path: string): Promise<T> {
    return retryWithBackoff(async () => {
      const response = await fetch(`${IMPACT_API_BASE}${path}`, {
        headers: {
          // Impact's REST API expects HTTP Basic
          // credentials: Account SID as the username,
          // Auth Token as the password.
          Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = new Error(`Impact API error: HTTP ${response.status}`) as Error & {
          status: number;
        };
        error.status = response.status;
        throw error;
      }

      return (await response.json()) as T;
    });
  }

  async searchOffers(query: string): Promise<ImpactOffer[]> {
    if (!this.hasCredentials()) {
      throw new Error("Impact account SID and auth token are not configured");
    }

    // The Partner API lists the campaigns (programs)
    // the account has joined; it has no free-text
    // search parameter, so the harvest filters by
    // campaign name, description, and advertiser
    // client-side. The path segment is `MediaPartners` with a capital P:
    // impact.com's routes are case-sensitive and `Mediapartners` 404s, which
    // would silently yield no offers for this source.
    const filter = query.trim().toLowerCase();
    const body = await this.request<ImpactCampaignsResponse>(
      `/MediaPartners/${encodeURIComponent(this.accountSid)}/Campaigns`,
    );

    return (body.Campaigns ?? [])
      .filter((campaign) => {
        if (!filter) {
          return true;
        }
        return (
          campaign.CampaignName.toLowerCase().includes(filter) ||
          (campaign.CampaignDescription ?? "").toLowerCase().includes(filter) ||
          (campaign.AdvertiserName ?? "").toLowerCase().includes(filter)
        );
      })
      .map(mapCampaign);
  }

  async getOfferBySlug(campaignId: string): Promise<ImpactOffer | null> {
    if (!this.hasCredentials()) {
      throw new Error("Impact account SID and auth token are not configured");
    }

    try {
      const body = await this.request<ImpactCampaignsResponse | Partial<ImpactCampaign>>(
        `/MediaPartners/${encodeURIComponent(this.accountSid)}/Campaigns/${encodeURIComponent(campaignId)}`,
      );

      // The list endpoint wraps campaigns in a
      // Campaigns array; the single-resource endpoint
      // may return the campaign directly.
      const campaign = Array.isArray((body as ImpactCampaignsResponse).Campaigns)
        ? (body as ImpactCampaignsResponse).Campaigns[0]
        : (body as Partial<ImpactCampaign>);

      return campaign?.CampaignId ? mapCampaign(campaign as ImpactCampaign) : null;
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }
}

function mapCampaign(campaign: ImpactCampaign): ImpactOffer {
  return {
    id: campaign.CampaignId,
    name: campaign.CampaignName,
    slug: campaign.CampaignId,
    // Campaign-level data carries no price — deal
    // pricing lives on the advertiser's site and in
    // the campaign's deals endpoint.
    price: 0,
    // Campaign listings do not carry a currency;
    // Impact's primary settlement currency is USD.
    currency: "USD",
    description: campaign.CampaignDescription ?? "",
    // Campaigns have no category taxonomy; the
    // program type is surfaced through the
    // advertiser metadata instead.
    category: "",
    advertiser: campaign.AdvertiserName ?? "",
    // Commission rates are private to the partner
    // agreement and are not exposed on campaigns.
    commission_rate: 0,
    url: campaign.CampaignUrl || campaign.AdvertiserUrl,
    trackingLink: campaign.TrackingLink || undefined,
    images: campaign.CampaignLogoUri ? [campaign.CampaignLogoUri] : undefined,
    logo_url: campaign.CampaignLogoUri || undefined,
  };
}

export const impactClient = new ImpactClient();
