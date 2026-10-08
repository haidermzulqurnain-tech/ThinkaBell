import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { redis } from "./redis";
import { EXCHANGE_RATE_CACHE_KEY, getExchangeRates } from "./exchangeRateService";
import { normalizePrice, formatNormalizedPrice } from "./priceNormalizer";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch;

beforeEach(async () => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  vi.clearAllMocks();
  await redis.del(EXCHANGE_RATE_CACHE_KEY);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function fxResponse(rates: Record<string, number>) {
  return { ok: true, json: async () => ({ rates }) } as unknown as Response;
}

// Frankfurter-style payload: units per 1 USD.
const LIVE_RATES = { EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.52, JPY: 150 };

describe("exchangeRateService", () => {
  it("should fetch live rates and invert units-per-USD to USD-per-unit", async () => {
    mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));

    const rates = await getExchangeRates();

    expect(rates.USD).toBe(1);
    expect(rates.EUR).toBeCloseTo(1 / 0.92, 5);
    expect(rates.JPY).toBeCloseTo(1 / 150, 5);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]![0]).toContain("base=USD");
    expect(mockFetch.mock.calls[0]![0]).toContain("symbols=EUR,GBP,CAD,AUD,JPY");
  });

  it("should serve cached rates without refetching", async () => {
    mockFetch.mockResolvedValue(fxResponse(LIVE_RATES));

    await getExchangeRates();
    const rates = await getExchangeRates();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(rates.EUR).toBeCloseTo(1 / 0.92, 5);
  });

  it("should ignore a corrupted cache entry and refetch", async () => {
    await redis.set(EXCHANGE_RATE_CACHE_KEY, { EUR: "not-a-number" });

    mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));
    const rates = await getExchangeRates();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(rates.EUR).toBeCloseTo(1 / 0.92, 5);
  });

  it("should fall back to static rates when the FX API is unreachable", async () => {
    mockFetch.mockRejectedValue(new Error("fetch failed"));

    const rates = await getExchangeRates();

    expect(rates.EUR).toBe(1.08);
    expect(rates.JPY).toBe(0.0067);
  });

  it("should fall back when the response payload is malformed", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);

    const rates = await getExchangeRates();

    expect(rates.GBP).toBe(1.27);
  });

  it("should fall back when a supported currency is missing from the response", async () => {
    mockFetch.mockResolvedValueOnce(fxResponse({ EUR: 0.92 }));

    const rates = await getExchangeRates();

    expect(rates.CAD).toBe(0.74);
  });

  it("should fall back when the API responds with an HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 } as unknown as Response);

    const rates = await getExchangeRates();

    expect(rates.AUD).toBe(0.65);
  });
});

describe("priceNormalizer", () => {
  describe("normalizePrice", () => {
    it("should normalize EUR to USD using live rates", async () => {
      mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));

      const result = await normalizePrice(100, "EUR");

      expect(result.amount).toBeCloseTo(100 / 0.92, 2);
      expect(result.currency).toBe("USD");
      expect(result.originalCurrency).toBe("EUR");
      expect(result.originalAmount).toBe(100);
      expect(result.exchangeRate).toBeCloseTo(1 / 0.92, 5);
    });

    it("should invert JPY units-per-USD rates correctly", async () => {
      mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));

      const result = await normalizePrice(15000, "JPY");

      expect(result.amount).toBeCloseTo(100, 2);
      expect(result.exchangeRate).toBeCloseTo(1 / 150, 5);
    });

    it("should keep USD as USD with rate 1", async () => {
      mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));

      const result = await normalizePrice(50, "USD");

      expect(result.amount).toBe(50);
      expect(result.exchangeRate).toBe(1);
    });

    it("should fall back to static rates when the FX API fails", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      const result = await normalizePrice(100, "EUR");

      expect(result.amount).toBeCloseTo(108, 2);
      expect(result.exchangeRate).toBe(1.08);
    });

    it("should handle lowercase currency codes", async () => {
      mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));

      const result = await normalizePrice(100, "eur");

      expect(result.originalCurrency).toBe("EUR");
      expect(result.amount).toBeCloseTo(100 / 0.92, 2);
    });

    it("should handle currency with whitespace", async () => {
      mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));

      const result = await normalizePrice(100, " eur ");

      expect(result.originalCurrency).toBe("EUR");
    });

    it("should default to USD for unsupported currencies", async () => {
      mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));

      const result = await normalizePrice(100, "XYZ");

      expect(result.originalCurrency).toBe("USD");
      expect(result.amount).toBe(100);
      expect(result.exchangeRate).toBe(1);
    });

    it("should return amount rounded to 2 decimal places", async () => {
      mockFetch.mockResolvedValueOnce(fxResponse(LIVE_RATES));

      const result = await normalizePrice(100, "JPY");

      expect(result.amount).toBeCloseTo(0.67, 2);
    });
  });

  describe("formatNormalizedPrice", () => {
    it("should format USD price without original currency", () => {
      const normalized = { amount: 99.99, currency: "USD" as const, originalCurrency: "USD" as const, originalAmount: 99.99, exchangeRate: 1 };
      expect(formatNormalizedPrice(normalized)).toBe("$99.99");
    });

    it("should format non-USD price with conversion note", () => {
      const normalized = { amount: 108, currency: "USD" as const, originalCurrency: "EUR" as const, originalAmount: 100, exchangeRate: 1.08 };
      expect(formatNormalizedPrice(normalized)).toBe("$108.00 USD (EUR 100.00)");
    });
  });
});
