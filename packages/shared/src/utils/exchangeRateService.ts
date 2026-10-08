import { env } from "@thinkabell/config";
import { redis } from "./redis";
import { logger } from "./logger";
import { retryWithBackoff } from "./retry";

export type SupportedCurrency = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "JPY";

export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
];

// Last-resort static rates (USD per 1 unit of currency). Only used when
// the live exchange rate API is unreachable — never the primary source.
export const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
  AUD: 0.65,
  JPY: 0.0067,
};

export const EXCHANGE_RATE_CACHE_KEY = "exchange_rates:usd_base";

// Live rates are cached for 1 hour. Fallback rates are negative-cached
// for 60 seconds so an FX API outage does not trigger a retried fetch
// (with backoff) for every product in a price-check run.
const LIVE_RATE_TTL_SECONDS = 60 * 60;
const FALLBACK_RATE_TTL_SECONDS = 60;

interface ExchangeRateApiResponse {
  rates?: Record<string, unknown>;
}

function isValidRateMap(value: unknown): value is Record<SupportedCurrency, number> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return SUPPORTED_CURRENCIES.every((currency) => {
    const rate = candidate[currency];
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
  });
}

// Live FX APIs report units-per-USD (1 USD = 155 JPY). Invert to the
// USD-per-unit convention used by FALLBACK_RATES so both sources share
// one conversion direction. Returns null when any supported currency is
// missing or non-positive — the caller then fails closed to fallback.
function toUsdPerUnit(
  rates: Record<string, unknown>,
): Record<SupportedCurrency, number> | null {
  const converted: Partial<Record<SupportedCurrency, number>> = { USD: 1 };

  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency === "USD") continue;

    const unitsPerUsd = rates[currency];
    if (
      typeof unitsPerUsd !== "number" ||
      !Number.isFinite(unitsPerUsd) ||
      unitsPerUsd <= 0
    ) {
      return null;
    }

    converted[currency] = 1 / unitsPerUsd;
  }

  return converted as Record<SupportedCurrency, number>;
}

async function fetchLiveRates(): Promise<Record<SupportedCurrency, number> | null> {
  try {
    const symbols = SUPPORTED_CURRENCIES.filter((c) => c !== "USD").join(",");
    const url = `${env.EXCHANGE_RATE_API_URL}?base=USD&symbols=${symbols}`;

    const response = await retryWithBackoff(
      () =>
        fetch(url).then(async (res) => {
          if (!res.ok) {
            const err = new Error(`HTTP ${res.status}`) as Error & { status: number };
            err.status = res.status;
            throw err;
          }
          return res;
        }),
      { maxAttempts: 3, retryableStatuses: [408, 429, 500, 502, 503, 504] },
    );

    const data = (await response.json()) as ExchangeRateApiResponse;
    if (!data.rates || typeof data.rates !== "object") {
      return null;
    }

    return toUsdPerUnit(data.rates);
  } catch (error) {
    logger.warn(
      "[ExchangeRateService] Live exchange rate fetch failed; using fallback rates",
      { error: error instanceof Error ? error.message : String(error) },
    );
    return null;
  }
}

async function cacheRates(
  rates: Record<SupportedCurrency, number>,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(EXCHANGE_RATE_CACHE_KEY, rates, { ex: ttlSeconds });
  } catch (error) {
    logger.warn("[ExchangeRateService] Exchange rate cache write failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Returns USD-per-unit rates for every supported currency. Serves from the
// Redis cache when fresh (validated before use); otherwise fetches live
// rates and caches them. Falls back to static rates — negative-cached
// briefly — when the FX API is unreachable or returns an incomplete
// payload, so price normalization never breaks the calling pipeline.
export async function getExchangeRates(): Promise<Record<SupportedCurrency, number>> {
  try {
    const cached = await redis.get<unknown>(EXCHANGE_RATE_CACHE_KEY);
    if (isValidRateMap(cached)) {
      return cached;
    }
  } catch (error) {
    logger.warn("[ExchangeRateService] Exchange rate cache read failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const liveRates = await fetchLiveRates();

  if (liveRates) {
    await cacheRates(liveRates, LIVE_RATE_TTL_SECONDS);
    return liveRates;
  }

  await cacheRates(FALLBACK_RATES, FALLBACK_RATE_TTL_SECONDS);
  return FALLBACK_RATES;
}
