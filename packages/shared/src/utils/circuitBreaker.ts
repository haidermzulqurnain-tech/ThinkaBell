import { logger } from "./logger";
import { redis } from "./redis";

export type CircuitState = "closed" | "open" | "half-open";

interface CircuitStateData {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly key: string;

  constructor(key: string, threshold = 5, recoveryTimeoutMs = 30000) {
    this.key = `circuit:${key}`;
    this.threshold = threshold;
    this.recoveryTimeoutMs = recoveryTimeoutMs;
    this.loadState().catch((err) => {
      logger.debug("[CircuitBreaker] Failed to load state on construction", err as Record<string, unknown>);
    });
  }

  async loadState(): Promise<void> {
    try {
      const stored = await redis.get<CircuitStateData>(this.key);
      if (stored) {
        this.state = stored.state;
        this.failureCount = stored.failureCount;
        this.lastFailureTime = stored.lastFailureTime;
      }
    } catch (err) {
      logger.debug("[CircuitBreaker] Failed to load state from Redis", err as Record<string, unknown>);
    }
  }

  private async persistState(): Promise<void> {
    try {
      await redis.set(this.key, {
        state: this.state,
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime,
      } as Record<string, unknown>);
    } catch (err) {
      logger.debug("[CircuitBreaker] Failed to persist state to Redis", err as Record<string, unknown>);
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.state = "half-open";
        logger.info("[CircuitBreaker] Transitioning to half-open state");
        await this.persistState();
      } else {
        throw new Error("Circuit breaker is open - external API temporarily unavailable");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      await this.persistState();
      return result;
    } catch (error) {
      this.onFailure();
      await this.persistState();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = "open";
      logger.warn(`[CircuitBreaker] Circuit opened after ${this.failureCount} failures`);
    }
  }

  reset() {
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.persistState();
  }

  getState(): CircuitState {
    return this.state;
  }
}
