import { logger } from "./logger";

export type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  retryableStatuses?: number[];
};

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 4,
  initialDelayMs: 500,
  maxDelayMs: 8000,
  factor: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let attempt = 0;
  let lastError: unknown;

  while (attempt < opts.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      if (attempt >= opts.maxAttempts) {
        break;
      }

      const isRetryable = isRetryableError(error, opts.retryableStatuses);

      if (!isRetryable) {
        throw error;
      }

      const delay = Math.min(opts.initialDelayMs * opts.factor ** (attempt - 1), opts.maxDelayMs);
      const jitter = Math.random() * delay * 0.1;
      const sleepMs = delay + jitter;

      logger.warn(`[Retry] Attempt ${attempt} failed, retrying in ${sleepMs.toFixed(0)}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });

      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  logger.error(`[Retry] All ${opts.maxAttempts} attempts failed`);
  throw lastError;
}

function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof Error) {
    // Retry timeout errors
    if (error.message.toLowerCase().includes("timeout")) {
      return true;
    }

    // Retry errors with retryable HTTP status
    if ("status" in error && typeof (error as { status?: number }).status === "number") {
      const status = (error as { status: number }).status;
      if (retryableStatuses.includes(status)) {
        return true;
      }
    }

    // Retry network errors
    if (
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("network")
    ) {
      return true;
    }
  }

  return false;
}
