import { redis } from "./redis";
import { logger } from "./logger";

/**
 * Rate limits requests per identifier within a fixed/sliding time window.
 *
 * @param identifier Unique rate-limiting key (e.g. `subscribe:${ip}`)
 * @param limit Maximum allowed requests within the window
 * @param windowSeconds Duration of the rate-limit window in seconds
 * @param failClosed Optional. If true, returns false on Redis error instead of failing open
 * @returns boolean `true` if allowed, `false` if rate limit exceeded
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
  failClosed = false,
): Promise<boolean> {
  const key = `ratelimit:${identifier}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      logger.warn(`[RateLimit] Limit exceeded for key ${key} (${current}/${limit})`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`[RateLimit] Error checking rate limit for ${identifier}`, error);
    if (failClosed) {
      return false;
    }
    return true;
  }
}
