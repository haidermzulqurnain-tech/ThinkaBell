/**
 * @file packages/database/src/repositories/retailerLinkRepository.test.ts
 * @description Unit tests for RetailerLinkRepository methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RetailerLinkRepository } from "./retailerLinkRepository";

function createChainableMock(returnValue: any) {
  const chain: any = {};
  const methods = ["select", "eq", "update", "insert", "upsert", "order", "limit", "single", "rpc", "then", "in"];
  for (const method of methods) {
    if (method === "then") {
      chain[method] = (onFulfilled: any) => {
        return Promise.resolve({ data: returnValue.data ?? returnValue, error: returnValue.error ?? null }).then(onFulfilled);
      };
    } else {
      chain[method] = vi.fn(() => {
        if (method === "single") {
          return { ...returnValue };
        }
        return chain;
      });
    }
  }
  return chain;
}

const mockAnonClient = { from: vi.fn() };
const mockServiceClient = { from: vi.fn(), rpc: vi.fn() };

vi.mock("../client", () => ({
  getSupabaseAnonClient: () => mockAnonClient,
  getSupabaseServiceClient: () => mockServiceClient,
}));

describe("RetailerLinkRepository", () => {
  const mockLink = {
    id: 1,
    product_id: 1,
    retailer: "amazon" as const,
    affiliate_url: "https://amazon.com/dp/B0TEST",
    is_sponsored: true,
    click_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLinksForProduct", () => {
    it("should fetch all retailer links for a product", async () => {
      const chain = createChainableMock({ data: [mockLink], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await RetailerLinkRepository.getLinksForProduct(1);

      expect(mockAnonClient.from).toHaveBeenCalledWith("retailer_links");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("product_id", 1);
      expect(result).toEqual([mockLink]);
    });

    it("should return empty array on database error", async () => {
      const chain = createChainableMock({ data: null, error: { message: "DB error", code: "500" } });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await RetailerLinkRepository.getLinksForProduct(999);
      expect(result).toEqual([]);
    });
  });

  describe("upsertLink", () => {
    it("should upsert a retailer link and return the created row", async () => {
      const chain = createChainableMock({ data: mockLink, error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const result = await RetailerLinkRepository.upsertLink(1, "amazon", "https://amazon.com/dp/B0TEST", true);

      expect(mockServiceClient.from).toHaveBeenCalledWith("retailer_links");
      expect(chain.upsert).toHaveBeenCalledWith(
        {
          product_id: 1,
          retailer: "amazon",
          affiliate_url: "https://amazon.com/dp/B0TEST",
          is_sponsored: true,
        },
        { onConflict: "product_id,retailer" },
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockLink);
    });

    it("should throw on upsert failure", async () => {
      const chain = createChainableMock({ data: null, error: { message: "Upsert failed", code: "23505" } });
      mockServiceClient.from.mockReturnValue(chain);

      await expect(
        RetailerLinkRepository.upsertLink(1, "amazon", "https://amazon.com/dp/B0TEST"),
      ).rejects.toEqual({ message: "Upsert failed", code: "23505" });
    });
  });

  describe("incrementClickCount", () => {
    it("should increment click count via RPC when available", async () => {
      const rpcChain = createChainableMock({ data: null, error: null });
      mockServiceClient.rpc.mockResolvedValue({ error: null });

      await RetailerLinkRepository.incrementClickCount(1);

      expect(mockServiceClient.rpc).toHaveBeenCalledWith("increment_retailer_click", { link_id: 1 });
    });

    it("should fallback to manual increment when RPC is missing", async () => {
      mockServiceClient.rpc.mockResolvedValue({ error: { message: "RPC missing", code: "42883" } });

      const selectChain = createChainableMock({ data: { click_count: 10 }, error: null });
      const updateChain = createChainableMock({ data: null, error: null });
      mockServiceClient.from.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);

      await RetailerLinkRepository.incrementClickCount(1);

      expect(selectChain.select).toHaveBeenCalledWith("click_count");
      expect(selectChain.eq).toHaveBeenCalledWith("id", 1);
      expect(updateChain.update).toHaveBeenCalledWith({ click_count: 11 });
      expect(updateChain.eq).toHaveBeenCalledWith("id", 1);
    });

    it("should throw on fallback update failure", async () => {
      mockServiceClient.rpc.mockResolvedValue({ error: { message: "RPC missing", code: "42883" } });

      const selectChain = createChainableMock({ data: { click_count: 10 }, error: null });
      const updateChain = createChainableMock({ data: null, error: { message: "Update failed", code: "500" } });
      mockServiceClient.from.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);

      await expect(RetailerLinkRepository.incrementClickCount(1)).rejects.toEqual({
        message: "Update failed",
        code: "500",
      });
    });
  });

  describe("getSponsoredLinksForProducts", () => {
    it("should fetch sponsored links for multiple products", async () => {
      const chain = createChainableMock({ data: [mockLink], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await RetailerLinkRepository.getSponsoredLinksForProducts([1, 2]);

      expect(mockAnonClient.from).toHaveBeenCalledWith("retailer_links");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.in).toHaveBeenCalledWith("product_id", [1, 2]);
      expect(chain.eq).toHaveBeenCalledWith("is_sponsored", true);
      expect(result).toEqual([mockLink]);
    });

    it("should return empty array on database error", async () => {
      const chain = createChainableMock({ data: null, error: { message: "DB error", code: "500" } });
      mockAnonClient.from.mockReturnValue(chain);

      const result = await RetailerLinkRepository.getSponsoredLinksForProducts([1]);
      expect(result).toEqual([]);
    });
  });
});
