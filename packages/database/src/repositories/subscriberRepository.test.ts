/**
 * @file packages/database/src/repositories/subscriberRepository.test.ts
 * @description Unit tests for SubscriberRepository methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

function createChainableMock(returnValue: any) {
  const chain: any = {};
  const methods = ["select", "eq", "upsert", "single", "maybeSingle", "then"];
  for (const method of methods) {
    if (method === "then") {
      chain[method] = (onFulfilled: any) => {
        return Promise.resolve({ data: returnValue.data ?? returnValue, error: returnValue.error ?? null }).then(onFulfilled);
      };
    } else {
      chain[method] = vi.fn(() => {
        if (method === "single" || method === "maybeSingle") {
          return { ...returnValue };
        }
        return chain;
      });
    }
  }
  return chain;
}

const mockAnonClient = { from: vi.fn() };
const mockServiceClient = { from: vi.fn(), rpc: vi.fn() };

vi.mock("../client", () => ({
  getSupabaseAnonClient: () => mockAnonClient,
  getSupabaseServiceClient: () => mockServiceClient,
}));

describe("SubscriberRepository", () => {
  const mockSubscriber = {
    id: 1,
    email: "test@example.com",
    push_subscription_id: "push-123",
    preferences: {
      categories: ["physical", "software"],
      min_discount: 10,
    },
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertSubscriber", () => {
    it("should upsert a subscriber keyed by blind index", async () => {
      const chain = createChainableMock({ data: mockSubscriber, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { SubscriberRepository } = await import("./subscriberRepository");
      const result = await SubscriberRepository.upsertSubscriber(
        "test@example.com",
        "hash-test@example.com",
        "push-123",
        { categories: ["physical"], min_discount: 15 },
      );

      expect(mockAnonClient.from).toHaveBeenCalledWith("subscribers");
      expect(chain.upsert).toHaveBeenCalledWith(
        {
          email: "test@example.com",
          email_hash: "hash-test@example.com",
          push_subscription_id: "push-123",
          preferences: { categories: ["physical"], min_discount: 15 },
        },
        { onConflict: "email_hash" },
      );
      expect(chain.select).toHaveBeenCalledWith();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockSubscriber);
    });

    it("should store the provided email value as-is (caller normalizes/encrypts)", async () => {
      const chain = createChainableMock({ data: mockSubscriber, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { SubscriberRepository } = await import("./subscriberRepository");
      await SubscriberRepository.upsertSubscriber(
        "encrypted-or-normalized-value",
        "test@example.com",
        null,
        undefined,
      );

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "encrypted-or-normalized-value",
          email_hash: "test@example.com",
        }),
        expect.any(Object),
      );
    });

    it("should use default preferences when none provided", async () => {
      const chain = createChainableMock({ data: mockSubscriber, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { SubscriberRepository } = await import("./subscriberRepository");
      await SubscriberRepository.upsertSubscriber("test@example.com", "test@example.com", null, undefined);

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: { categories: ["physical", "software"], min_discount: 10 },
        }),
        expect.any(Object),
      );
    });

    it("should throw error on upsert failure", async () => {
      const chain = createChainableMock({ data: null, error: { message: "Upsert failed", code: "23505" } });
      mockAnonClient.from.mockReturnValue(chain);

      const { SubscriberRepository } = await import("./subscriberRepository");
      await expect(
        SubscriberRepository.upsertSubscriber("test@example.com", "test@example.com"),
      ).rejects.toEqual({ message: "Upsert failed", code: "23505" });
    });
  });

  describe("getSubscriberByEmailHash", () => {
    it("should return the subscriber when the blind index matches", async () => {
      const chain = createChainableMock({ data: mockSubscriber, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { SubscriberRepository } = await import("./subscriberRepository");
      const result = await SubscriberRepository.getSubscriberByEmailHash("test@example.com");

      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("email_hash", "test@example.com");
      expect(chain.maybeSingle).toHaveBeenCalled();
      expect(result).toEqual(mockSubscriber);
    });

    it("should return null when no subscriber matches", async () => {
      const chain = createChainableMock({ data: null, error: null });
      mockAnonClient.from.mockReturnValue(chain);

      const { SubscriberRepository } = await import("./subscriberRepository");
      const result = await SubscriberRepository.getSubscriberByEmailHash("unknown");
      expect(result).toBeNull();
    });

    it("should return null on database error", async () => {
      const chain = createChainableMock({ data: null, error: { message: "Query failed" } });
      mockAnonClient.from.mockReturnValue(chain);

      const { SubscriberRepository } = await import("./subscriberRepository");
      const result = await SubscriberRepository.getSubscriberByEmailHash("test@example.com");
      expect(result).toBeNull();
    });
  });

  describe("getSubscribersForAlert", () => {
    const subscriberWithCategory = {
      ...mockSubscriber,
      id: 1,
      email: "cat-test@example.com",
      preferences: { categories: ["physical"], min_discount: 10 },
    };
    const subscriberWithoutCategory = {
      ...mockSubscriber,
      id: 2,
      email: "no-cat@example.com",
      preferences: { categories: ["software"], min_discount: 5 },
    };
    const subscriberAllCategories = {
      ...mockSubscriber,
      id: 3,
      email: "all-cat@example.com",
      preferences: { categories: ["physical", "software"], min_discount: 20 },
    };

    beforeEach(() => {
      mockServiceClient.rpc = vi.fn().mockResolvedValue({
        data: [
          subscriberWithCategory,
          subscriberWithoutCategory,
          subscriberAllCategories,
        ],
        error: null,
      });
    });

    it("should call get_subscribers_for_alert RPC with category and discount", async () => {
      const { SubscriberRepository } = await import("./subscriberRepository");
      await SubscriberRepository.getSubscribersForAlert("physical", 10);

      expect(mockServiceClient.rpc).toHaveBeenCalledWith("get_subscribers_for_alert", {
        p_category: "physical",
        p_min_discount: 10,
      });
    });

    it("should return server-filtered subscribers by category and discount", async () => {
      mockServiceClient.rpc = vi.fn().mockResolvedValue({
        data: [subscriberWithCategory],
        error: null,
      });

      const { SubscriberRepository } = await import("./subscriberRepository");
      const result = await SubscriberRepository.getSubscribersForAlert("physical", 10);

      expect(result).toEqual([subscriberWithCategory]);
    });

    it("should return empty array on database error", async () => {
      mockServiceClient.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Query failed", code: "500" },
      });

      const { SubscriberRepository } = await import("./subscriberRepository");
      const result = await SubscriberRepository.getSubscribersForAlert("physical", 10);
      expect(result).toEqual([]);
    });

    it("should include subscribers without category preferences", async () => {
      const noPrefSubscriber = {
        ...mockSubscriber,
        id: 4,
        email: "no-pref@example.com",
        preferences: {},
      };
      mockServiceClient.rpc = vi.fn().mockResolvedValue({
        data: [noPrefSubscriber],
        error: null,
      });

      const { SubscriberRepository } = await import("./subscriberRepository");
      const result = await SubscriberRepository.getSubscribersForAlert("physical", 10);
      expect(result).toContainEqual(noPrefSubscriber);
    });

    it("should handle empty categories array as no preference", async () => {
      const emptyCatSubscriber = {
        ...mockSubscriber,
        id: 5,
        email: "empty-cat@example.com",
        preferences: { categories: [], min_discount: 5 },
      };
      mockServiceClient.rpc = vi.fn().mockResolvedValue({
        data: [emptyCatSubscriber],
        error: null,
      });

      const { SubscriberRepository } = await import("./subscriberRepository");
      const result = await SubscriberRepository.getSubscribersForAlert("physical", 10);
      expect(result).toContainEqual(emptyCatSubscriber);
    });
  });
});