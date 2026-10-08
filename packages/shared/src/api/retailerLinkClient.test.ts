/**
 * @file packages/shared/src/api/retailerLinkClient.test.ts
 * @description Unit tests for RetailerLinkClient methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { retailerLinkClient } from "./retailerLinkClient";

describe("RetailerLinkClient", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_URL = "https://thinkabell.click";
  });

  describe("getAffiliateUrl", () => {
    it("should return affiliate URL from API", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ affiliateUrl: "https://amazon.com/dp/B0TEST" }),
        } as Response),
      );

      const result = await retailerLinkClient.getAffiliateUrl(1, "amazon");
      expect(result).toBe("https://amazon.com/dp/B0TEST");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://thinkabell.click/api/retailer-links?productId=1&retailer=amazon",
      );
    });

    it("should return null when API responds with not ok", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        } as Response),
      );

      const result = await retailerLinkClient.getAffiliateUrl(1, "amazon");
      expect(result).toBeNull();
    });

    it("should return null on network failure", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

      const result = await retailerLinkClient.getAffiliateUrl(1, "amazon");
      expect(result).toBeNull();
    });
  });

  describe("getSponsoredRetailer", () => {
    it("should return sponsored retailer from API", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ retailer: "amazon" }),
        } as Response),
      );

      const result = await retailerLinkClient.getSponsoredRetailer(1);
      expect(result).toBe("amazon");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://thinkabell.click/api/retailer-links/sponsored?productId=1",
      );
    });

    it("should return null when API responds with not ok", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        } as Response),
      );

      const result = await retailerLinkClient.getSponsoredRetailer(1);
      expect(result).toBeNull();
    });

    it("should return null on network failure", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

      const result = await retailerLinkClient.getSponsoredRetailer(1);
      expect(result).toBeNull();
    });
  });

  describe("recordClick", () => {
    it("should POST to click tracking endpoint", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
        } as Response),
      );

      await retailerLinkClient.recordClick(42);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://thinkabell.click/api/retailer-links/42/click",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    it("should not throw on network failure", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

      await expect(retailerLinkClient.recordClick(42)).resolves.toBeUndefined();
    });
  });
});
