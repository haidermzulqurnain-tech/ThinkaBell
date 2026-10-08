/**
 * @file packages/shared/src/api/amazonClient.test.ts
 * @description Unit tests for Amazon PA-API client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mutable config object - must be declared before mocks
const configState: Record<string, string> = {
  AMAZON_ACCESS_KEY: "",
  AMAZON_SECRET_KEY: "",
  AMAZON_PARTNER_TAG: "thinkabell-20",
  AMAZON_REGION: "us-east-1",
};

// Mock logger
vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config with getter to read mutable state
vi.mock("@thinkabell/config", () => ({
  env: configState,
}));

describe("AmazonClient", () => {
  const mockFetch = vi.fn();
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    vi.clearAllMocks();
    configState.AMAZON_ACCESS_KEY = "";
    configState.AMAZON_SECRET_KEY = "";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("getPrice without credentials", () => {
    it("should throw error when credentials are missing", async () => {
      vi.resetModules();
      const { amazonClient } = await import("./amazonClient");
      await expect(amazonClient.getPrice("B0CM5N4G3T")).rejects.toThrow("Amazon PA-API credentials are not configured");
    });
  });

  describe("getPrice with credentials", () => {
    beforeEach(() => {
      configState.AMAZON_ACCESS_KEY = "test-access-key";
      configState.AMAZON_SECRET_KEY = "test-secret-key";
    });

    it("should call PA-API endpoint with correct payload", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ItemsResult: {
            Items: [
              {
                Offers: {
                  Listings: [{ Price: { Amount: 99.99 } }],
                },
              },
            ],
          },
        }),
      } as unknown as Response);

      const { amazonClient } = await import("./amazonClient");
      const price = await amazonClient.getPrice("B0TEST1234");

      expect(price).toBe(99.99);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://webservices.amazon.com/paapi5/getitems",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"ItemIds":["B0TEST1234"]'),
        }),
      );
    });

    it("should return null when item not found", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      const { amazonClient } = await import("./amazonClient");
      const price = await amazonClient.getPrice("B0NOTFOUND");
      expect(price).toBeNull();
    });

    it("should return null when price is missing", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ItemsResult: { Items: [{ Offers: { Listings: [{}] } }] },
        }),
      } as unknown as Response);

      const { amazonClient } = await import("./amazonClient");
      const price = await amazonClient.getPrice("B0NOPRICE");
      expect(price).toBeNull();
    });

    it("should throw error on HTTP error", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      } as unknown as Response);

      const { amazonClient } = await import("./amazonClient");
      await expect(amazonClient.getPrice("B0ERROR")).rejects.toThrow("HTTP 400");
    });

    it("should throw error on network error", async () => {
      vi.resetModules();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { amazonClient } = await import("./amazonClient");
      await expect(amazonClient.getPrice("B0NETWORK")).rejects.toThrow("Network error");
    });

    it("should include required PA-API resources", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      const { amazonClient } = await import("./amazonClient");
      await amazonClient.getPrice("B0TEST");

      const callArgs = mockFetch.mock.calls[0] as [RequestInfo, RequestInit?];
      const body = JSON.parse(callArgs[1]!.body as string);
      expect(body.Resources).toContain("Offers.Listings.Price");
      expect(body.Resources).toContain("ItemInfo.Title");
      expect(body.PartnerTag).toBe("thinkabell-20");
      expect(body.PartnerType).toBe("Associates");
      expect(body.Marketplace).toBe("www.amazon.com");
    });

    it("should include AWS signature headers", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      const { amazonClient } = await import("./amazonClient");
      await amazonClient.getPrice("B0TEST");

      const callArgs = mockFetch.mock.calls[0] as [RequestInfo, RequestInit?];
      const headers = callArgs[1]!.headers as Record<string, string>;
      expect(headers["content-type"]).toContain("application/json");
      expect(headers["content-encoding"]).toBe("amz-1.0");
      expect(headers["x-amz-target"]).toContain("ProductAdvertisingAPIv1");
      expect(headers["Authorization"]).toContain("AWS4-HMAC-SHA256");
    });
  });

  describe("IAmazonClient interface", () => {
    it("should implement IAmazonClient interface", async () => {
      vi.resetModules();
      const { amazonClient } = await import("./amazonClient");
      expect(typeof amazonClient.getPrice).toBe("function");
    });
  });
});
