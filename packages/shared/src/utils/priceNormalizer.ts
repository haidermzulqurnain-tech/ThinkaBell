import {
  FALLBACK_RATES,
  SUPPORTED_CURRENCIES,
  getExchangeRates,
  type SupportedCurrency,
} from "./exchangeRateService";

export type { SupportedCurrency };

export interface NormalizedPrice {
  amount: number;
  currency: SupportedCurrency;
  originalCurrency: SupportedCurrency;
  originalAmount: number;
  exchangeRate: number;
}

export async function normalizePrice(
  amount: number,
  currency: string,
): Promise<NormalizedPrice> {
  const normalizedCurrency = currency.trim().toUpperCase() as SupportedCurrency;
  const originalCurrency = SUPPORTED_CURRENCIES.includes(normalizedCurrency)
    ? normalizedCurrency
    : "USD";
  const originalAmount = Number(amount);
  const rates = await getExchangeRates();
  const exchangeRate = rates[originalCurrency] ?? FALLBACK_RATES[originalCurrency];
  const usdAmount = Number((originalAmount * exchangeRate).toFixed(2));

  return {
    amount: usdAmount,
    currency: "USD",
    originalCurrency,
    originalAmount,
    exchangeRate,
  };
}

export function formatNormalizedPrice(normalized: NormalizedPrice): string {
  if (normalized.originalCurrency === "USD") {
    return `$${normalized.amount.toFixed(2)}`;
  }

  return `$${normalized.amount.toFixed(2)} USD (${normalized.originalCurrency} ${normalized.originalAmount.toFixed(2)})`;
}
