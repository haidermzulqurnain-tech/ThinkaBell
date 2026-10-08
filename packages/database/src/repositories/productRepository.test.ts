/**
 * @file packages/database/src/repositories/productRepository.test.ts
 * @description Unit tests for ProductRepository methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Create chainable mock builder where terminal methods return data
// Supabase chain: from() -> select() -> [not/order/eq/limit] -> maybeSingle/single/limit returns data
function createChainableMock(terminalReturn: any) {
  const chain: any = {};
  const methods = ["select", "not", "order", "limit", "eq", "update", "insert", "upsert", "maybeSingle", "single", "or", "then"];
  for (const method of methods) {
    if (method === "then") {
      chain[method] = (onFulfilled: any) => {
        return Promise.resolve({ data: terminalReturn.data ?? terminalReturn, error: terminalReturn.error ?? null }).then(onFulfilled);
      };
    } else {
      chain[method] = vi.fn(() => {
        if (method === "maybeSingle" || method === "single") {
          return terminalReturn;
        }
        if (method === "limit") {
          return terminalReturn;
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

describe("ProductRepository", () => {
  const mockProduct = {
    id: 1,
    name: "Test Product",
    slug: "test-product",
    category: "physical" as const,
    brand: "TestBrand",
    amazon_asin: "B0TEST1234",
    ebay_epid: null,
    affiliate_links: { amazon: "https://amazon.com/dp/B0TEST1234" },
    current_price: 99.99,
    previous_price: 129.99,
    price_updated_at: new Date().toISOString(),
    image_url: "https://example.com/image.jpg",
    description: "A test product",
    tags: ["test"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTopDeals", () => {
    it("should fetch top deals sorted by price_updated_at descending", async () => {
      const chain = createChainableMock({ data: [mockProduct], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      const result = await ProductRepository.getTopDeals(10);

      expect(mockAnonClient.from).toHaveBeenCalledWith("products");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.not).toHaveBeenCalledWith("current_price", "is", null);
      expect(chain.order).toHaveBeenCalledWith("price_updated_at", { ascending: false });
      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockProduct]);
    });

    it("should use default limit of 20 when not specified", async () => {
      const chain = createChainableMock({ data: [mockProduct], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      await ProductRepository.getTopDeals();

      expect(chain.limit).toHaveBeenCalledWith(20);
    });

    it("should return empty array on database error", async () => {
      const chain = createChainableMock({ data: null, error: { message: "DB error", code: "500" } });
      mockAnonClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      const result = await ProductRepository.getTopDeals();
      expect(result).toEqual([]);
    });

    it("should return empty array when no data returned", async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      const result = await ProductRepository.getTopDeals();
      expect(result).toEqual([]);
    });
  });

  describe("getBySlug", () => {
    it("should fetch a single product by slug", async () => {
      const chain = createChainableMock({ data: mockProduct, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      const result = await ProductRepository.getBySlug("test-product");

      expect(mockAnonClient.from).toHaveBeenCalledWith("products");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("slug", "test-product");
      expect(chain.maybeSingle).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it("should return null when product not found", async () => {
      const chain = createChainableMock({ data: null, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      const result = await ProductRepository.getBySlug("nonexistent");
      expect(result).toBeNull();
    });

    it("should return null on database error", async () => {
      const chain = createChainableMock({ data: null, error: { message: "Query failed", code: "PGRST116" } });
      mockAnonClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      const result = await ProductRepository.getBySlug("test-product");
      expect(result).toBeNull();
    });
  });

  describe("getTrackableProducts", () => {
    it("should fetch all products with ASIN or EPID", async () => {
      const chain = createChainableMock({ data: [mockProduct], error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      const result = await ProductRepository.getTrackableProducts();

      expect(mockServiceClient.from).toHaveBeenCalledWith("products");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.or).toHaveBeenCalledWith(
        "amazon_asin.not.is.null,ebay_epid.not.is.null",
      );
      expect(result).toEqual([mockProduct]);
    });

    it("should throw error on database failure", async () => {
      const chain = createChainableMock({ data: null, error: { message: "Query failed", code: "500" } });
      mockServiceClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      await expect(ProductRepository.getTrackableProducts()).rejects.toEqual({
        message: "Query failed",
        code: "500",
      });
    });
  });

  describe("updateProductPrice", () => {
    it("should update product price and timestamp", async () => {
      const chain = createChainableMock({ error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      await ProductRepository.updateProductPrice(1, 89.99, 99.99);

      expect(mockServiceClient.from).toHaveBeenCalledWith("products");
      expect(chain.update).toHaveBeenCalledWith({
        current_price: 89.99,
        previous_price: 99.99,
        price_updated_at: expect.any(String),
      });
      expect(chain.eq).toHaveBeenCalledWith("id", 1);
    });

    it("should throw error on update failure", async () => {
      const chain = createChainableMock({ error: { message: "Update failed", code: "23505" } });
      mockServiceClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      await expect(
        ProductRepository.updateProductPrice(1, 89.99, 99.99),
      ).rejects.toEqual({ message: "Update failed", code: "23505" });
    });

    it("should handle null previous price", async () => {
      const chain = createChainableMock({ error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { ProductRepository } = await import("./productRepository");
      await ProductRepository.updateProductPrice(1, 89.99, null);

      expect(chain.update).toHaveBeenCalledWith({
        current_price: 89.99,
        previous_price: null,
        price_updated_at: expect.any(String),
      });
    });
  });
});