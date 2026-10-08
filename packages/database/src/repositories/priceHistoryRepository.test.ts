/**
 * @file packages/database/src/repositories/priceHistoryRepository.test.ts
 * @description Unit tests for PriceHistoryRepository methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

function createChainableMock(returnValue: any) {
  const chain: any = {};
  const methods = ["select", "eq", "order", "limit", "insert", "then"];
  for (const method of methods) {
    if (method === "then") {
      chain[method] = (onFulfilled: any) => {
        return Promise.resolve({ data: returnValue.data ?? returnValue, error: returnValue.error ?? null }).then(onFulfilled);
      };
    } else {
      chain[method] = vi.fn(() => chain);
    }
  }
  return chain;
}

const mockAnonClient = { from: vi.fn() };
const mockServiceClient = { from: vi.fn() };

vi.mock("../client", () => ({
  getSupabaseAnonClient: () => mockAnonClient,
  getSupabaseServiceClient: () => mockServiceClient,
}));

describe("PriceHistoryRepository", () => {
  const mockHistory = {
    id: 1,
    product_id: 1,
    price: 99.99,
    source: "amazon",
    recorded_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getHistoryForProduct", () => {
    it("should fetch price history for a product sorted chronologically", async () => {
      const chain = createChainableMock({ data: [mockHistory], error: null });
      // Override limit to return data
      chain.limit.mockReturnValue({ data: [mockHistory], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { PriceHistoryRepository } = await import("./priceHistoryRepository");
      const result = await PriceHistoryRepository.getHistoryForProduct(1, 50);

      expect(mockAnonClient.from).toHaveBeenCalledWith("price_history");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("product_id", 1);
      expect(chain.order).toHaveBeenCalledWith("recorded_at", { ascending: true });
      expect(chain.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual([mockHistory]);
    });

    it("should use default limit of 50", async () => {
      const chain = createChainableMock({ data: [mockHistory], error: null });
      chain.limit.mockReturnValue({ data: [mockHistory], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { PriceHistoryRepository } = await import("./priceHistoryRepository");
      await PriceHistoryRepository.getHistoryForProduct(1);
      expect(chain.limit).toHaveBeenCalledWith(50);
    });

    it("should return empty array on database error", async () => {
      const chain = createChainableMock({ data: null, error: { message: "Query failed", code: "500" } });
      chain.limit.mockReturnValue({ data: null, error: { message: "Query failed", code: "500" } });
      mockAnonClient.from.mockReturnValue(chain);

      const { PriceHistoryRepository } = await import("./priceHistoryRepository");
      const result = await PriceHistoryRepository.getHistoryForProduct(999);
      expect(result).toEqual([]);
    });

    it("should return empty array when no data", async () => {
      const chain = createChainableMock({ data: [], error: null });
      chain.limit.mockReturnValue({ data: [], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { PriceHistoryRepository } = await import("./priceHistoryRepository");
      const result = await PriceHistoryRepository.getHistoryForProduct(1);
      expect(result).toEqual([]);
    });
  });

  describe("recordPrice", () => {
    it("should insert a new price history record", async () => {
      const chain = createChainableMock({ error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { PriceHistoryRepository } = await import("./priceHistoryRepository");
      await PriceHistoryRepository.recordPrice(1, 89.99, "amazon");

      expect(mockServiceClient.from).toHaveBeenCalledWith("price_history");
      expect(chain.insert).toHaveBeenCalledWith({
        product_id: 1,
        price: 89.99,
        source: "amazon",
        recorded_at: expect.any(String),
      });
    });

    it("should throw error on insert failure", async () => {
      const chain = createChainableMock({ error: { message: "Insert failed", code: "23503" } });
      mockServiceClient.from.mockReturnValue(chain);

      const { PriceHistoryRepository } = await import("./priceHistoryRepository");
      await expect(PriceHistoryRepository.recordPrice(1, 89.99, "amazon")).rejects.toEqual({
        message: "Insert failed",
        code: "23503",
      });
    });

    it("should record price for different sources", async () => {
      const chain = createChainableMock({ error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { PriceHistoryRepository } = await import("./priceHistoryRepository");

      await PriceHistoryRepository.recordPrice(1, 99.99, "amazon");
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ source: "amazon" }),
      );

      await PriceHistoryRepository.recordPrice(2, 49.99, "ebay");
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ source: "ebay" }),
      );

      await PriceHistoryRepository.recordPrice(3, 19.99, "direct");
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ source: "direct" }),
      );
    });

    it("should include ISO timestamp", async () => {
      const chain = createChainableMock({ error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { PriceHistoryRepository } = await import("./priceHistoryRepository");
      const before = new Date().toISOString();
      await PriceHistoryRepository.recordPrice(1, 99.99, "amazon");
      const after = new Date().toISOString();

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          recorded_at: expect.any(String),
        }),
      );
    });
  });
});