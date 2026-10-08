import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
  ProductRepository: {
    upsertDiscoveredProducts: vi
      .fn()
      .mockResolvedValue({ inserted: 1, updated: 0 }),
  },
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockCircuitBreaker = {
  loadState: vi.fn(),
  execute: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  getState: vi.fn(() => "closed" as const),
};

const mockAmazonListSource = {
  search: vi.fn(),
};

vi.mock("@thinkabell/shared", () => ({
  logger: mockLogger,
  redis: { get: vi.fn(), set: vi.fn() },
  CircuitBreaker: vi.fn(() => mockCircuitBreaker),
  AmazonListSource: vi.fn(() => mockAmazonListSource),
  ebayClient: {},
  walmartClient: {},
  partnerStackClient: {},
  appSumoClient: {},
  impactClient: {},
}));

const harvestedProduct = {
  sourceId: "B08N5WRWNW",
  source: "amazon-list" as const,
  amazonAsin: "B08N5WRWNW",
  name: "Wireless Headphones",
  description: "Wireless Headphones",
  price: 49.99,
  currency: "USD",
  url: "https://amazon.com/dp/B08N5WRWNW",
  affiliateUrl: "https://amazon.com/dp/B08N5WRWNW?tag=thinkabell-20",
  metadata: { marketplace: "US", affiliateTagConfigured: true },
};

describe("productDiscoveryRunner (amazon-list)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DISCOVERY_SOURCES = JSON.stringify([
      { name: "amazon-list", type: "physical", queries: [], enabled: true },
    ]);
    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") {
        return Promise.resolve({ data: true, error: null });
      }
      if (name === "release_job_lock") {
        return Promise.resolve({ error: null });
      }
      if (name === "insert_job_run") {
        return Promise.resolve({ data: { id: 1 }, error: null });
      }
      if (name === "update_job_run") {
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue({ select: vi.fn() } as never);
    mockAmazonListSource.search.mockResolvedValue([harvestedProduct]);
  });

  it("harvests curated Amazon lists and upserts the products", async () => {
    const { ProductRepository } = await import("@thinkabell/database");
    const { runProductDiscovery } = await import("./productDiscoveryRunner");

    const result = await runProductDiscovery();

    expect(mockAmazonListSource.search).toHaveBeenCalledWith("");
    expect(ProductRepository.upsertDiscoveredProducts).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          sourceId: "B08N5WRWNW",
          source: "amazon-list",
          amazonAsin: "B08N5WRWNW",
          name: "Wireless Headphones",
          price: 49.99,
          currency: "USD",
          url: "https://amazon.com/dp/B08N5WRWNW",
          affiliateUrl:
            "https://amazon.com/dp/B08N5WRWNW?tag=thinkabell-20",
          type: "physical",
        }),
      ],
    );
    expect(result.discovered).toBe(1);
    expect(result.sources).toContain("amazon-list");
    expect(result.errors).toEqual([]);
  });

  it("filters harvested items by title query when provided", async () => {
    process.env.DISCOVERY_SOURCES = JSON.stringify([
      {
        name: "amazon-list",
        type: "physical",
        queries: ["headphones"],
        enabled: true,
      },
    ]);
    const { runProductDiscovery } = await import("./productDiscoveryRunner");

    await runProductDiscovery();

    expect(mockAmazonListSource.search).toHaveBeenCalledWith("headphones");
  });

  it("records harvest failures as run errors", async () => {
    mockAmazonListSource.search.mockRejectedValue(new Error("boom"));
    const { runProductDiscovery } = await import("./productDiscoveryRunner");

    const result = await runProductDiscovery();

    expect(result.discovered).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("boom");
  });

  it("skips the run when no discovery sources are configured", async () => {
    process.env.DISCOVERY_SOURCES = "";
    const { runProductDiscovery } = await import("./productDiscoveryRunner");

    const result = await runProductDiscovery();

    expect(result).toEqual({ discovered: 0, sources: [], errors: [] });
    expect(mockAmazonListSource.search).not.toHaveBeenCalled();
  });

  it("ignores disabled amazon-list sources", async () => {
    process.env.DISCOVERY_SOURCES = JSON.stringify([
      { name: "amazon-list", type: "physical", queries: [], enabled: false },
    ]);
    const { runProductDiscovery } = await import("./productDiscoveryRunner");

    const result = await runProductDiscovery();

    expect(result).toEqual({ discovered: 0, sources: [], errors: [] });
    expect(mockAmazonListSource.search).not.toHaveBeenCalled();
  });
});
