import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BROWSE_HTML = `
<html><body>
  <script id="__NEXT_DATA__" type="application/json">
  {
    "props": {
      "pageProps": {
        "fallbackData": [
          {
            "deals": [
              {
                "id": 260413,
                "public_name": "TidyCal",
                "card_description": "Book clients, sell packages, collect payments",
                "slug": "tidycal",
                "get_absolute_url": "/products/tidycal/",
                "product_logo": "https://cdn.appsumo.com/tidycal-logo.png",
                "featured_image_url": "https://cdn.appsumo.com/tidycal-web.png",
                "media_url": "https://cdn.appsumo.com/tidycal-media.png",
                "price": 29,
                "original_price": 144,
                "is_free": false,
                "product_tags": [],
                "taxonomy": {
                  "category": { "search_values": ["Calendar & Scheduling"] },
                  "subcategory": { "search_values": ["Scheduling & Bookings"] }
                },
                "dates": { "start_date": "2026-09-01T17:00:00Z", "end_date": null },
                "has_started": true,
                "has_ended": false,
                "browse_deal_status": "current"
              },
              {
                "id": 260414,
                "public_name": "Free Tool",
                "card_description": "A free productivity tool",
                "slug": "free-tool",
                "get_absolute_url": "/products/free-tool/",
                "product_logo": "",
                "featured_image_url": "https://cdn.appsumo.com/free-web.png",
                "media_url": "",
                "price": 0,
                "original_price": 0,
                "is_free": true,
                "product_tags": ["Productivity"],
                "taxonomy": {},
                "dates": {
                  "start_date": null,
                  "end_date": "2026-12-31T23:59:59Z"
                },
                "has_started": true,
                "has_ended": false,
                "browse_deal_status": "current"
              }
            ]
          }
        ]
      }
    }
  }
  </script>
</body></html>
`;

const PRODUCT_HTML = `
<html><body>
  <script id="__NEXT_DATA__" type="application/json">
  {
    "props": {
      "pageProps": {
        "deal": {
          "id": 260413,
          "public_name": "TidyCal",
          "card_description": "Book clients, sell packages, collect payments",
          "slug": "tidycal",
          "get_absolute_url": "/products/tidycal/",
          "product_logo": "https://cdn.appsumo.com/tidycal-logo.png",
          "featured_image_url": "https://cdn.appsumo.com/tidycal-web.png",
          "media_url": "https://cdn.appsumo.com/tidycal-media.png",
          "price": 29,
          "original_price": 144,
          "is_free": false,
          "product_tags": [],
          "taxonomy": {
            "category": { "search_values": ["Calendar & Scheduling"] }
          },
          "dates": { "start_date": "2026-09-01T17:00:00Z", "end_date": null }
        }
      }
    }
  }
  </script>
</body></html>
`;

describe("AppSumoClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("harvests deals from the server-rendered browse page", async () => {
    fetchMock.mockResolvedValueOnce(new Response(BROWSE_HTML));

    const { appSumoClient } = await import("./appSumoClient");
    const deals = await appSumoClient.searchDeals("");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://appsumo.com/browse/",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "text/html" }),
      }),
    );
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      id: "260413",
      slug: "tidycal",
      name: "TidyCal",
      price: 29,
      originalPrice: 144,
      currency: "USD",
      category: "Calendar & Scheduling",
      url: "https://appsumo.com/products/tidycal/",
      imageUrl: "https://cdn.appsumo.com/tidycal-logo.png",
    });
  });

  it("searches via the server-side browse query parameter", async () => {
    fetchMock.mockResolvedValueOnce(new Response(BROWSE_HTML));

    const { appSumoClient } = await import("./appSumoClient");
    await appSumoClient.searchDeals("seo tools");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://appsumo.com/browse/?query=seo%20tools",
      expect.anything(),
    );
  });

  it("maps free deals to a zero price and expiresAt from the end date", async () => {
    fetchMock.mockResolvedValueOnce(new Response(BROWSE_HTML));

    const { appSumoClient } = await import("./appSumoClient");
    const deals = await appSumoClient.searchDeals("");

    expect(deals[1]).toMatchObject({
      price: 0,
      expiresAt: "2026-12-31T23:59:59Z",
      category: "Productivity",
    });
  });

  it("fetches a single deal from the product page", async () => {
    fetchMock.mockResolvedValueOnce(new Response(PRODUCT_HTML));

    const { appSumoClient } = await import("./appSumoClient");
    const deal = await appSumoClient.getDealBySlug("tidycal");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://appsumo.com/products/tidycal/",
      expect.anything(),
    );
    expect(deal).toMatchObject({
      id: "260413",
      slug: "tidycal",
      name: "TidyCal",
      price: 29,
      currency: "USD",
    });
  });

  it("returns null when the product page has no deal payload", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html><body>no data</body></html>"));

    const { appSumoClient } = await import("./appSumoClient");
    const deal = await appSumoClient.getDealBySlug("missing");

    expect(deal).toBeNull();
  });

  it("degrades to no deals when the page shape changes", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html><body>changed</body></html>"));

    const { appSumoClient } = await import("./appSumoClient");
    const deals = await appSumoClient.searchDeals("");

    expect(deals).toEqual([]);
  });
});
