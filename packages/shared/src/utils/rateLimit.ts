import { redis } from "./redis";
import { logger } from "./logger";

/**
 * Rate limits requests per identifier within a fixed/sliding time window.
 *
 * @param identifier Unique rate-limiting key (e.g. `subscribe:${ip}`)
 * @param limit Maximum allowed requests within the window
 * @param windowSeconds Duration of the rate-limit window in seconds
 * @returns boolean `true` if allowed, `false` if rate limit exceeded
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = `ratelimit:${identifier}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      // First hit in this window: set TTL
      await redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      logger.warn(`[RateLimit] Limit exceeded for key ${key} (${current}/${limit})`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`[RateLimit] Error checking rate limit for ${identifier}`, error);
    // Fail-open strategy to prevent blocking legitimate users during cache degradation
    return true;
  }
}
