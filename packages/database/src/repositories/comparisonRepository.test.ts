/**
 * @file packages/database/src/repositories/comparisonRepository.test.ts
 * @description Unit tests for ComparisonRepository methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

function createProductChain(terminal: { data: unknown; error: unknown }) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => terminal);
  chain.not = vi.fn(() => chain);
  return chain;
}

function createSlugChain(terminal: { data: unknown; error: unknown }) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.not = vi.fn(() => terminal);
  return chain;
}

const mockAnonClient = { from: vi.fn() };

vi.mock("../client", () => ({
  getSupabaseAnonClient: () => mockAnonClient,
  getSupabaseServiceClient: () => ({ from: vi.fn(), rpc: vi.fn() }),
}));

const mockProduct = {
  id: 1,
  name: "Test Product",
  slug: "test-product",
  category: "physical" as const,
  brand: "TestBrand",
  amazon_asin: "B0TEST1234",
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

describe("ComparisonRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getComparableProducts", () => {
    it("should fetch active products with prices for a category", async () => {
      const chain = createProductChain({ data: [mockProduct], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { ComparisonRepository } = await import("./comparisonRepository");
      const result = await ComparisonRepository.getComparableProducts("physical", 4);

      expect(mockAnonClient.from).toHaveBeenCalledWith("products");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("category", "physical");
      expect(chain.eq).toHaveBeenCalledWith("is_active", true);
      expect(chain.order).toHaveBeenCalledWith("price_updated_at", { ascending: false });
      expect(chain.limit).toHaveBeenCalledWith(4);
      expect(result).toEqual([mockProduct]);
    });

    it("should clamp limit between 1 and 10", async () => {
      const chain = createProductChain({ data: [], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { ComparisonRepository } = await import("./comparisonRepository");
      await ComparisonRepository.getComparableProducts("software", 99);
      expect(chain.limit).toHaveBeenLastCalledWith(10);

      await ComparisonRepository.getComparableProducts("software", 0);
      expect(chain.limit).toHaveBeenLastCalledWith(1);
    });

    it("should return empty array on query error", async () => {
      const chain = createProductChain({ data: null, error: { message: "db error" } });
      mockAnonClient.from.mockReturnValue(chain);

      const { ComparisonRepository } = await import("./comparisonRepository");
      const result = await ComparisonRepository.getComparableProducts("physical");
      expect(result).toEqual([]);
    });
  });

  describe("getBySlugs", () => {
    it("should return empty array for empty slugs without querying", async () => {
      const { ComparisonRepository } = await import("./comparisonRepository");
      const result = await ComparisonRepository.getBySlugs([]);
      expect(result).toEqual([]);
      expect(mockAnonClient.from).not.toHaveBeenCalled();
    });

    it("should fetch products by slugs and cap at 20", async () => {
      const chain = createSlugChain({ data: [mockProduct], error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { ComparisonRepository } = await import("./comparisonRepository");
      const slugs = Array.from({ length: 25 }, (_, i) => `slug-${i}`);
      const result = await ComparisonRepository.getBySlugs(slugs);

      expect(mockAnonClient.from).toHaveBeenCalledWith("products");
      expect(chain.in).toHaveBeenCalledWith("slug", slugs.slice(0, 20));
      expect(chain.eq).toHaveBeenCalledWith("is_active", true);
      expect(result).toEqual([mockProduct]);
    });

    it("should return empty array on query error", async () => {
      const chain = createSlugChain({ data: null, error: { message: "db error" } });
      mockAnonClient.from.mockReturnValue(chain);

      const { ComparisonRepository } = await import("./comparisonRepository");
      const result = await ComparisonRepository.getBySlugs(["a", "b"]);
      expect(result).toEqual([]);
    });
  });
});
