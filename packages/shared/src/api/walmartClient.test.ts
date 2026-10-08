/**
 * @file packages/shared/src/api/walmartClient.test.ts
 * @description Unit tests for Walmart API client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    WALMART_API_KEY: "",
    WALMART_AFFILIATE_ID: "",
    WALMART_AFFILIATE_TRACK_ID: "",
  },
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

describe("WalmartClient", () => {
  const mockFetch = vi.fn();
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    vi.clearAllMocks();
    mockConfig.WALMART_API_KEY = "";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("getItemPrice without credentials", () => {
    it("should throw error when API key is missing", async () => {
      vi.resetModules();
      const { walmartClient } = await import("./walmartClient");
      await expect(walmartClient.getItemPrice("ITEM-12345")).rejects.toThrow("Walmart API key is not configured");
    });
  });

  describe("getItemPrice with credentials", () => {
    beforeEach(() => {
      mockConfig.WALMART_API_KEY = "test-api-key";
    });

    it("should fetch item price from API", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ price: 49.99, salePrice: 39.99 }),
      } as unknown as Response);

      const { walmartClient } = await import("./walmartClient");
      const price = await walmartClient.getItemPrice("ITEM-TEST");

      expect(price).toBe(39.99);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.walmart.com/api/v1/item/ITEM-TEST",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-RapidAPI-Key": "test-api-key",
          }),
        }),
      );
    });

    it("should use regular price when salePrice is missing", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ price: 79.99 }),
      } as unknown as Response);

      const { walmartClient } = await import("./walmartClient");
      const price = await walmartClient.getItemPrice("ITEM-REGULAR");
      expect(price).toBe(79.99);
    });

    it("should return null when price is missing", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      const { walmartClient } = await import("./walmartClient");
      const price = await walmartClient.getItemPrice("ITEM-NOPRICE");
      expect(price).toBeNull();
    });

    it("should throw error on HTTP error", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      const { walmartClient } = await import("./walmartClient");
      await expect(walmartClient.getItemPrice("ITEM-404")).rejects.toThrow("HTTP 404");
    });

    it("should throw error on network error", async () => {
      vi.resetModules();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { walmartClient } = await import("./walmartClient");
      await expect(walmartClient.getItemPrice("ITEM-NET")).rejects.toThrow("Network error");
    });

    it("should encode item IDs in URL", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ price: 19.99 }),
      } as unknown as Response);

      const { walmartClient } = await import("./walmartClient");
      await walmartClient.getItemPrice("item/with/special chars");

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain(encodeURIComponent("item/with/special chars"));
    });
  });

  describe("searchItems without credentials", () => {
    it("should throw error when API key is missing", async () => {
      vi.resetModules();
      const { walmartClient } = await import("./walmartClient");
      await expect(walmartClient.searchItems("test", 3)).rejects.toThrow("Walmart API key is not configured");
    });
  });

  describe("searchItems with credentials", () => {
    beforeEach(() => {
      mockConfig.WALMART_API_KEY = "test-api-key";
    });

    it("should search items with query and limit", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { id: "1", name: "Item 1", price: 10.0 },
            { id: "2", name: "Item 2", price: 20.0 },
          ],
        }),
      } as unknown as Response);

      const { walmartClient } = await import("./walmartClient");
      const results = await walmartClient.searchItems("laptop", 5);

      expect(results).toHaveLength(2);
      expect(results[0]!.name).toBe("Item 1");

      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain("query=laptop");
      expect(url).toContain("num=5");
    });

    it("should return empty array when items is missing", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      const { walmartClient } = await import("./walmartClient");
      const results = await walmartClient.searchItems("empty", 5);
      expect(results).toEqual([]);
    });

    it("should throw error on search API errors", async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as unknown as Response);

      const { walmartClient } = await import("./walmartClient");
      await expect(walmartClient.searchItems("error", 5)).rejects.toThrow("HTTP 400");
    });
  });

  describe("IWalmartClient interface", () => {
    it("should implement IWalmartClient interface", async () => {
      vi.resetModules();
      const { walmartClient } = await import("./walmartClient");
      expect(typeof walmartClient.getItemPrice).toBe("function");
      expect(typeof walmartClient.searchItems).toBe("function");
    });
  });
});
