import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig: Record<string, unknown> = {
  IMPACT_ACCOUNT_SID: "",
  IMPACT_AUTH_TOKEN: "",
};

vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

const CAMPAIGNS_RESPONSE = {
  Campaigns: [
    {
      AdvertiserId: "adv-1",
      AdvertiserName: "Acme Software",
      AdvertiserUrl: "https://acme.example.com",
      CampaignId: "camp-123",
      CampaignName: "Acme CRM Affiliate Program",
      CampaignUrl: "https://acme.example.com/affiliate",
      CampaignDescription: "CRM for growing teams",
      Type: "Performance",
      CampaignLogoUri: "https://acme.example.com/logo.png",
      ContractStatus: "Active",
      TrackingLink: "https://impact.com/camp-123?subId1=organic",
    },
    {
      AdvertiserId: "adv-2",
      AdvertiserName: "Other Software",
      AdvertiserUrl: "https://other.example.com",
      CampaignId: "camp-456",
      CampaignName: "Other Email Tool",
      CampaignUrl: "https://other.example.com/affiliate",
      CampaignDescription: "Email marketing",
      Type: "Performance",
      ContractStatus: "Active",
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ImpactClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockConfig.IMPACT_ACCOUNT_SID = "";
    mockConfig.IMPACT_AUTH_TOKEN = "";
  });

  it("should throw error when credentials are missing", async () => {
    const { impactClient } = await import("./impactClient");

    await expect(impactClient.searchOffers("developer tools")).rejects.toThrow(
      "Impact account SID and auth token are not configured",
    );
  });

  it("should throw error for getOfferBySlug when credentials are missing", async () => {
    const { impactClient } = await import("./impactClient");

    await expect(impactClient.getOfferBySlug("camp-123")).rejects.toThrow(
      "Impact account SID and auth token are not configured",
    );
  });

  it("lists campaigns with HTTP Basic auth from the real endpoint", async () => {
    mockConfig.IMPACT_ACCOUNT_SID = "account-sid";
    mockConfig.IMPACT_AUTH_TOKEN = "auth-token";
    fetchMock.mockResolvedValueOnce(jsonResponse(CAMPAIGNS_RESPONSE));

    const { impactClient } = await import("./impactClient");
    const offers = await impactClient.searchOffers("");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.impact.com/Mediapartners/account-sid/Campaigns",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${btoa("account-sid:auth-token")}`,
          Accept: "application/json",
        }),
      }),
    );
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      id: "camp-123",
      slug: "camp-123",
      name: "Acme CRM Affiliate Program",
      advertiser: "Acme Software",
      url: "https://acme.example.com/affiliate",
      trackingLink: "https://impact.com/camp-123?subId1=organic",
      logo_url: "https://acme.example.com/logo.png",
    });
  });

  it("filters campaigns by the query client-side", async () => {
    mockConfig.IMPACT_ACCOUNT_SID = "account-sid";
    mockConfig.IMPACT_AUTH_TOKEN = "auth-token";
    fetchMock.mockResolvedValueOnce(jsonResponse(CAMPAIGNS_RESPONSE));

    const { impactClient } = await import("./impactClient");
    const offers = await impactClient.searchOffers("email");

    expect(offers).toHaveLength(1);
    expect(offers[0]!.slug).toBe("camp-456");
  });

  it("returns null when the campaign is unknown", async () => {
    mockConfig.IMPACT_ACCOUNT_SID = "account-sid";
    mockConfig.IMPACT_AUTH_TOKEN = "auth-token";
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    const { impactClient } = await import("./impactClient");
    const offer = await impactClient.getOfferBySlug("camp-999");

    expect(offer).toBeNull();
  });
});
