/**
 * @file packages/shared/src/api/ebayClient.test.ts
 * @description Unit tests for eBay Browse API client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EbayBrowseApiClient } from "./ebayClient";

const mockConfig = vi.hoisted(() => ({
  EBAY_CLIENT_ID: "",
  EBAY_CLIENT_SECRET: "",
  EBAY_AFFILIATE_CAMPAIGN_ID: "",
}));

vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@thinkabell/config", () => ({
  env: mockConfig,
}));

describe("EbayClient", () => {
  const mockFetch = vi.fn();
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    vi.clearAllMocks();
    mockConfig.EBAY_CLIENT_ID = "";
    mockConfig.EBAY_CLIENT_SECRET = "";
    mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID = "";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("getPrice without credentials", () => {
    it("should throw error when credentials are missing", async () => {
      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      await expect(client.getPrice("EPID-12345")).rejects.toThrow("eBay OAuth credentials are not configured");
    });
  });

  describe("getPrice with credentials", () => {
    beforeEach(() => {
      mockConfig.EBAY_CLIENT_ID = "test-client-id";
      mockConfig.EBAY_CLIENT_SECRET = "test-client-secret";
    });

    it("should acquire OAuth token and fetch price", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "test-access-token", expires_in: 7200 }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: { value: "149.99" } }),
        } as unknown as Response);

      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      const price = await client.getPrice("EPID-TEST123");

      expect(price).toBe(149.99);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should use cached token on subsequent calls", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "token-1", expires_in: 7200 }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: { value: "99.99" } }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: { value: "89.99" } }),
        } as unknown as Response);

      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      await client.getPrice("EPID-FIRST");
      const price = await client.getPrice("EPID-SECOND");
      expect(price).toBe(89.99);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should throw error when OAuth fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      } as unknown as Response);

      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      await expect(client.getPrice("EPID-FAIL")).rejects.toThrow("HTTP 401");
    });

    it("should throw error when item not found", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "token", expires_in: 7200 }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as unknown as Response);

      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      await expect(client.getPrice("EPID-NOTFOUND")).rejects.toThrow("HTTP 404");
    });

    it("should return null when price value is missing", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "token", expires_in: 7200 }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as unknown as Response);

      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      const price = await client.getPrice("EPID-PRICE-MISSING");
      expect(price).toBeNull();
    });

    it("should include affiliate campaign header when configured", async () => {
      mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID = "5338000000";
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "token", expires_in: 7200 }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: { value: "199.99" } }),
        } as unknown as Response);

      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      await client.getPrice("EPID-AFF");

      const itemCall = mockFetch.mock.calls[1]!;
      const headers = (itemCall[1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-EBAY-C-ENDUSERCTX"]).toContain("affiliateCampaignId=5338000000");
    });

    it("should throw error on network errors", async () => {
      mockConfig.EBAY_CLIENT_ID = "test-client-id";
      mockConfig.EBAY_CLIENT_SECRET = "test-client-secret";
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "token", expires_in: 7200 }),
        } as unknown as Response)
        .mockRejectedValueOnce(new Error("Network error"));

      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      await expect(client.getPrice("EPID-NETWORK")).rejects.toThrow("Network error");
    });

    it("should encode item IDs in URL", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "token", expires_in: 7200 }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: { value: "50.00" } }),
        } as unknown as Response);

      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      await client.getPrice("test item/123");

      const url = mockFetch.mock.calls[1]![0] as string;
      expect(url).toContain("test%20item%2F123");
    });
  });

  describe("IEbayClient interface", () => {
    it("should implement IEbayClient interface", async () => {
      const client = new EbayBrowseApiClient(mockConfig.EBAY_CLIENT_ID, mockConfig.EBAY_CLIENT_SECRET, mockConfig.EBAY_AFFILIATE_CAMPAIGN_ID);
      expect(typeof client.getPrice).toBe("function");
    });
  });
});
