import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig: Record<string, unknown> = {
  PARTNERSTACK_API_KEY: "",
};

vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

const PROGRAMS_RESPONSE = {
  data: {
    items: [
      {
        id: 123,
        key: "acme-crm",
        name: "Acme CRM",
        description: "CRM for growing teams",
        category: ["Sales", "CRM"],
        country: "US",
        website: "https://acme.example.com",
        logo: "img_abc123",
        offers: [{ base_rate: "0.25", currency: "USD", type_: "percentage" }],
      },
      {
        id: 456,
        key: "acme-email",
        name: "Acme Email",
        description: "Email marketing platform",
        category: ["Marketing"],
        country: "US",
        website: "https://acme.example.com/email",
        logo: "img_def456",
        offers: [],
      },
    ],
    has_more: false,
    total: 2,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PartnerStackClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockConfig.PARTNERSTACK_API_KEY = "";
  });

  it("should throw error when API key is missing", async () => {
    const { partnerStackClient } = await import("./partnerStackClient");

    await expect(partnerStackClient.searchProducts("crm")).rejects.toThrow(
      "PartnerStack API key is not configured",
    );
  });

  it("should throw error for getProductBySlug when API key is missing", async () => {
    const { partnerStackClient } = await import("./partnerStackClient");

    await expect(partnerStackClient.getProductBySlug("acme-crm")).rejects.toThrow(
      "PartnerStack API key is not configured",
    );
  });

  it("harvests marketplace programs from the real /api/v2 endpoint", async () => {
    mockConfig.PARTNERSTACK_API_KEY = "partner-key";
    fetchMock.mockResolvedValueOnce(jsonResponse(PROGRAMS_RESPONSE));

    const { partnerStackClient } = await import("./partnerStackClient");
    const products = await partnerStackClient.searchProducts("");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://api.partnerstack.com/api/v2/marketplace/programs"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer partner-key",
          Accept: "application/json",
        }),
      }),
    );
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      id: "123",
      slug: "acme-crm",
      name: "Acme CRM",
      // The marketplace listing publishes no
      // vendor price.
      price: 0,
      currency: "USD",
      commission_rate: 0.25,
      url: "https://acme.example.com",
      vendor: "Acme CRM",
      category: "Sales, CRM",
    });
  });

  it("filters programs by the query client-side", async () => {
    mockConfig.PARTNERSTACK_API_KEY = "partner-key";
    fetchMock.mockResolvedValueOnce(jsonResponse(PROGRAMS_RESPONSE));

    const { partnerStackClient } = await import("./partnerStackClient");
    const products = await partnerStackClient.searchProducts("email");

    expect(products).toHaveLength(1);
    expect(products[0]!.slug).toBe("acme-email");
  });

  it("follows the pagination cursor while has_more is true", async () => {
    mockConfig.PARTNERSTACK_API_KEY = "partner-key";
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [
              {
                id: 1,
                key: "first-key",
                name: "First Program",
                description: "First",
                category: [],
                website: "https://first.example.com",
                offers: [],
              },
            ],
            has_more: true,
            total: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [
              {
                id: 2,
                key: "second-key",
                name: "Second Program",
                description: "Second",
                category: [],
                website: "https://second.example.com",
                offers: [],
              },
            ],
            has_more: false,
            total: 2,
          },
        }),
      );

    const { partnerStackClient } = await import("./partnerStackClient");
    const products = await partnerStackClient.searchProducts("");

    expect(products).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toContain("starting_after=first-key");
  });

  it("returns null when the program key is unknown", async () => {
    mockConfig.PARTNERSTACK_API_KEY = "partner-key";
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    const { partnerStackClient } = await import("./partnerStackClient");
    const product = await partnerStackClient.getProductBySlug("unknown-key");

    expect(product).toBeNull();
  });
});
