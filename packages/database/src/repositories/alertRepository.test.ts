/**
 * @file packages/database/src/repositories/alertRepository.test.ts
 * @description Unit tests for AlertRepository methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

function createChainableMock(returnValue: any) {
  const chain: any = {};
  const methods = ["select", "eq", "update", "insert", "order", "limit", "single", "rpc", "then", "onConflict"];
  for (const method of methods) {
    if (method === "then") {
      chain[method] = (onFulfilled: any) => {
        return Promise.resolve({ data: returnValue.data ?? returnValue, error: returnValue.error ?? null }).then(onFulfilled);
      };
    } else {
      chain[method] = vi.fn(() => {
        if (method === "single") {
          return { ...returnValue };
        }
        return chain;
      });
    }
  }
  return chain;
}

const mockServiceClient = { from: vi.fn(), rpc: vi.fn() };

vi.mock("../client", () => ({
  getSupabaseServiceClient: () => mockServiceClient,
}));

describe("AlertRepository", () => {
  const mockAlert = {
    id: 1,
    product_id: 1,
    subscriber_id: 1,
    old_price: 1999.0,
    new_price: 1749.0,
    discount_percent: 12.51,
    created_at: new Date().toISOString(),
    sent: false,
    attempts: 0,
    last_error: null,
  };

  const mockAlertWithProduct = {
    ...mockAlert,
    products: {
      id: 1,
      name: "Test Product",
      slug: "test-product",
      category: "physical",
      brand: "TestBrand",
      image_url: "https://example.com/image.jpg",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueueAlert", () => {
    it("should insert a new alert into alert_queue", async () => {
      const chain = createChainableMock({ data: mockAlert, error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      const result = await AlertRepository.enqueueAlert(1, 1, 1999.0, 1749.0, 12.51);

      expect(mockServiceClient.from).toHaveBeenCalledWith("alert_queue");
      expect(chain.insert).toHaveBeenCalledWith({
        product_id: 1,
        subscriber_id: 1,
        old_price: 1999.0,
        new_price: 1749.0,
        discount_percent: 12.51,
        sent: false,
      });
      expect(chain.onConflict).toHaveBeenCalledWith("product_id,subscriber_id,sent");
      expect(chain.select).toHaveBeenCalledWith();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockAlert);
    });

    it("should throw error on insert failure", async () => {
      const chain = createChainableMock({ data: null, error: { message: "Insert failed", code: "23503" } });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      await expect(
        AlertRepository.enqueueAlert(1, 1, 1999.0, 1749.0, 12.51),
      ).rejects.toEqual({ message: "Insert failed", code: "23503" });
    });

    it("should handle large discount percentages", async () => {
      const chain = createChainableMock({ data: { ...mockAlert, discount_percent: 70.79 }, error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      const result = await AlertRepository.enqueueAlert(3, 1, 286.8, 83.76, 70.79);
      expect(result.discount_percent).toBe(70.79);
    });
  });

  describe("getPendingAlerts", () => {
    it("should fetch unsent alerts with product data", async () => {
      const chain = createChainableMock({ data: [mockAlertWithProduct], error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      const result = await AlertRepository.getPendingAlerts(50);

      expect(mockServiceClient.from).toHaveBeenCalledWith("alert_queue");
      expect(chain.select).toHaveBeenCalledWith("*, products(*)");
      expect(chain.eq).toHaveBeenCalledWith("sent", false);
      expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: true });
      expect(chain.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual([mockAlertWithProduct]);
    });

    it("should use default limit of 50", async () => {
      const chain = createChainableMock({ data: [mockAlertWithProduct], error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      await AlertRepository.getPendingAlerts();
      expect(chain.limit).toHaveBeenCalledWith(50);
    });

    it("should throw error on query failure", async () => {
      const chain = createChainableMock({ data: null, error: { message: "Query failed", code: "500" } });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      await expect(AlertRepository.getPendingAlerts()).rejects.toEqual({
        message: "Query failed",
        code: "500",
      });
    });

    it("should return empty array when no pending alerts", async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      const result = await AlertRepository.getPendingAlerts();
      expect(result).toEqual([]);
    });
  });

  describe("markAlertSent", () => {
    it("should mark alert as sent", async () => {
      const chain = createChainableMock({ error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      await AlertRepository.markAlertSent(1);

      expect(mockServiceClient.from).toHaveBeenCalledWith("alert_queue");
      expect(chain.update).toHaveBeenCalledWith({ sent: true });
      expect(chain.eq).toHaveBeenCalledWith("id", 1);
    });

    it("should throw error on update failure", async () => {
      const chain = createChainableMock({ error: { message: "Update failed", code: "23505" } });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      await expect(AlertRepository.markAlertSent(999)).rejects.toEqual({
        message: "Update failed",
        code: "23505",
      });
    });
  });

  describe("recordFailure", () => {
    it("should call increment_alert_attempt RPC", async () => {
      mockServiceClient.rpc.mockReturnValue({ error: null });

      const { AlertRepository } = await import("./alertRepository");
      await AlertRepository.recordFailure(1, "Network timeout");

      expect(mockServiceClient.rpc).toHaveBeenCalledWith("increment_alert_attempt", {
        alert_id: 1,
        error_text: "Network timeout",
      });
    });

    it("should fallback to direct update when RPC fails", async () => {
      mockServiceClient.rpc.mockReturnValue({ error: { message: "RPC not found", code: "42883" } });
      const chain = createChainableMock({ error: null });
      mockServiceClient.from.mockReturnValue(chain);

      const { AlertRepository } = await import("./alertRepository");
      await AlertRepository.recordFailure(1, "Test error");

      expect(chain.update).toHaveBeenCalledWith({
        last_error: "Test error",
      });
      expect(chain.eq).toHaveBeenCalledWith("id", 1);
    });

    it("should handle various error messages", async () => {
      mockServiceClient.rpc.mockReturnValue({ error: null });

      const { AlertRepository } = await import("./alertRepository");
      await AlertRepository.recordFailure(5, "OneSignal API rate limited");
      expect(mockServiceClient.rpc).toHaveBeenCalledWith("increment_alert_attempt", {
        alert_id: 5,
        error_text: "OneSignal API rate limited",
      });
    });
  });
});