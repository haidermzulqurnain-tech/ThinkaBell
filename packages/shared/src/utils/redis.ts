import { Redis } from "@upstash/redis";
import { env } from "@thinkabell/config";
import { logger } from "./logger";

export interface ICacheClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<string | boolean>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

class InMemoryCacheClient implements ICacheClient {
  private store = new Map<string, { value: unknown; expiresAt: number | null }>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<boolean> {
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return true;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    let current = 0;
    if (entry && (!entry.expiresAt || Date.now() <= entry.expiresAt)) {
      current = typeof entry.value === "number" ? entry.value : 0;
    }
    const next = current + 1;
    this.store.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}

function createRedisClient(): ICacheClient {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const upstash = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
      logger.info("[Redis] Initialized Upstash Redis client");
      return upstash as unknown as ICacheClient;
    } catch (err) {
      logger.warn("[Redis] Failed to initialize Upstash Redis, falling back to memory cache", { err });
    }
  }

  logger.debug("[Redis] Using in-memory cache client (Upstash credentials not provided)");
  return new InMemoryCacheClient();
}

export const redis: ICacheClient = createRedisClient();
