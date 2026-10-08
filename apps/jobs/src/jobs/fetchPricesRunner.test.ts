import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockProductRepository = {
  getTrackableProducts: vi.fn(),
  updateProductPrice: vi.fn(),
};

const mockSubscriberRepository = {
  getSubscribersForAlert: vi.fn(),
};

const mockAlertRepository = {
  enqueueAlert: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      then: vi.fn((onFulfilled) => Promise.resolve({ error: null }).then(onFulfilled)),
    })),
  })),
  rpc: vi.fn(),
};

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
  ProductRepository: mockProductRepository,
  SubscriberRepository: mockSubscriberRepository,
  AlertRepository: mockAlertRepository,
}));

const mockAmazonClient = {
  getPrice: vi.fn(),
};

const mockEbayClient = {
  getPrice: vi.fn(),
};

const mockWalmartClient = {
  getItemPrice: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@thinkabell/shared", () => ({
  amazonClient: mockAmazonClient,
  ebayClient: mockEbayClient,
  walmartClient: mockWalmartClient,
  redis: mockRedis,
  logger: mockLogger,
  CircuitBreaker: class MockCircuitBreaker {
    constructor(key: string) {}
    async loadState() {}
    async execute<T>(fn: () => Promise<T>) {
      return fn();
    }
  },
}));

describe("fetchPricesRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockProductRepository.getTrackableProducts.mockResolvedValue([]);
    mockProductRepository.updateProductPrice.mockResolvedValue(undefined);
    mockSubscriberRepository.getSubscribersForAlert.mockResolvedValue([]);
    mockAlertRepository.enqueueAlert.mockResolvedValue({ id: 1 });
    mockAmazonClient.getPrice.mockResolvedValue(null);
    mockEbayClient.getPrice.mockResolvedValue(null);
    mockWalmartClient.getItemPrice.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return updated=0 and alertsQueued=0 when no products found", async () => {
    mockProductRepository.getTrackableProducts.mockResolvedValue([]);

    const { runFetchPrices } = await import("./fetchPricesRunner");
    const result = await runFetchPrices();

    expect(result).toEqual({ updated: 0, alertsQueued: 0 });
    expect(mockLogger.info).toHaveBeenCalledWith("[fetchPrices] Starting price check run");
  });

  it("should process products and detect price changes for Amazon", async () => {
    const mockProducts = [
      {
        id: 1,
        name: "Test Product",
        amazon_asin: "B0TEST123",
        current_price: 100.0,
      },
    ];

    mockProductRepository.getTrackableProducts.mockResolvedValue(mockProducts);
    mockAmazonClient.getPrice.mockResolvedValue(89.99);

    const { runFetchPrices } = await import("./fetchPricesRunner");
    const result = await runFetchPrices();

    expect(mockProductRepository.updateProductPrice).toHaveBeenCalledWith(1, 89.99, 100.0);
    expect(result.updated).toBe(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Price change for "Test Product"'),
    );
  });

  it("should skip products with no price data", async () => {
    const mockProducts = [
      {
        id: 1,
        name: "Test Product",
        amazon_asin: "B0TEST123",
        current_price: 100.0,
      },
    ];

    mockProductRepository.getTrackableProducts.mockResolvedValue(mockProducts);
    mockAmazonClient.getPrice.mockResolvedValue(null);

    const { runFetchPrices } = await import("./fetchPricesRunner");
    const result = await runFetchPrices();

    expect(mockProductRepository.updateProductPrice).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it("should process eBay products", async () => {
    const mockProducts = [
      {
        id: 2,
        name: "eBay Product",
        ebay_epid: "EPID-123456",
        current_price: 50.0,
      },
    ];

    mockProductRepository.getTrackableProducts.mockResolvedValue(mockProducts);
    mockEbayClient.getPrice.mockResolvedValue(45.0);

    const { runFetchPrices } = await import("./fetchPricesRunner");
    const result = await runFetchPrices();

    expect(mockProductRepository.updateProductPrice).toHaveBeenCalledWith(2, 45.0, 50.0);
    expect(result.updated).toBe(1);
  });

  it("should queue alerts for subscribers when discount >= 5%", async () => {
    const mockProducts = [
      {
        id: 1,
        name: "Test Product",
        amazon_asin: "B0TEST123",
        category: "physical",
        current_price: 100.0,
      },
    ];

    const mockSubscribers = [
      { id: 1, email: "test@example.com" },
      { id: 2, email: "test2@example.com" },
    ];

    mockProductRepository.getTrackableProducts.mockResolvedValue(mockProducts);
    mockAmazonClient.getPrice.mockResolvedValue(89.99);
    mockSubscriberRepository.getSubscribersForAlert.mockResolvedValue(mockSubscribers);
    mockRedis.get.mockResolvedValue(null);

    const { runFetchPrices } = await import("./fetchPricesRunner");
    const result = await runFetchPrices();

    expect(mockSubscriberRepository.getSubscribersForAlert).toHaveBeenCalledWith("physical", expect.closeTo(10.01, 0.1));
    expect(mockRedis.set).toHaveBeenCalledWith("alert_sent:1:1", "1", { ex: 86400 });
    expect(result.alertsQueued).toBe(2);
  });

  it("should not queue duplicate alerts within 24 hours", async () => {
    const mockProducts = [
      {
        id: 1,
        name: "Test Product",
        amazon_asin: "B0TEST123",
        category: "physical",
        current_price: 100.0,
      },
    ];

    const mockSubscribers = [
      { id: 1, email: "test@example.com" },
      { id: 2, email: "test2@example.com" },
    ];

    mockProductRepository.getTrackableProducts.mockResolvedValue(mockProducts);
    mockAmazonClient.getPrice.mockResolvedValue(89.99);
    mockSubscriberRepository.getSubscribersForAlert.mockResolvedValue(mockSubscribers);
    mockRedis.get.mockResolvedValue("1");

    const { runFetchPrices } = await import("./fetchPricesRunner");
    const result = await runFetchPrices();

    expect(mockSubscriberRepository.getSubscribersForAlert).toHaveBeenCalledWith("physical", expect.closeTo(10.01, 0.1));
    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(result.alertsQueued).toBe(0);
  });
});
