import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
        in: vi.fn(() => ({
          then: vi.fn((onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled)),
        })),
        limit: vi.fn(() => ({
          then: vi.fn((onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled)),
        })),
        then: vi.fn((onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled)),
      })),
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          then: vi.fn((onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled)),
        })),
      })),
      then: vi.fn((onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled)),
      in: vi.fn(() => ({
        then: vi.fn((onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled)),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        then: vi.fn((onFulfilled) => Promise.resolve({ error: null }).then(onFulfilled)),
      })),
    })),
    insert: vi.fn(() => ({
      then: vi.fn((onFulfilled) => Promise.resolve({ error: null }).then(onFulfilled)),
    })),
  })),
  rpc: vi.fn(),
};

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
  AlertRepository: {
    recordFailure: vi.fn(),
  },
  SubscriberRepository: {
    getSubscribersForAlert: vi.fn(),
  },
  RetailerLinkRepository: {
    getLinksForProduct: vi.fn(),
    incrementClickCount: vi.fn(),
  },
}));

const mockNotificationClient = {
  sendPush: vi.fn(),
  sendEmail: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockEnv = {
  NEXT_PUBLIC_APP_URL: "https://thinkabell.click",
};

const mockDecryptField = vi.fn(async (value: string | null | undefined) => value ?? null);

vi.mock("@thinkabell/shared", () => ({
  notificationClient: mockNotificationClient,
  logger: mockLogger,
  env: mockEnv,
  retryWithBackoff: vi.fn(async (fn: () => Promise<any>) => fn()),
  decryptField: mockDecryptField,
  getEncryptionKey: vi.fn(() => null),
}));

describe("sendAlertsRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") {
        return Promise.resolve({ data: true, error: null });
      }
      if (name === "release_job_lock") {
        return Promise.resolve({ error: null });
      }
      if (name === "insert_job_run") {
        return Promise.resolve({ data: { id: 1 }, error: null });
      }
      if (name === "update_job_run") {
        return Promise.resolve({ error: null });
      }
      if (name === "get_next_alerts") {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === "move_to_dead_letter") {
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })) as any,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any);
    mockNotificationClient.sendPush.mockResolvedValue(true);
    mockNotificationClient.sendEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return processed=0 when no pending alerts", async () => {
    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") return Promise.resolve({ data: true, error: null });
      if (name === "release_job_lock") return Promise.resolve({ error: null });
      if (name === "insert_job_run") return Promise.resolve({ data: { id: 1 }, error: null });
      if (name === "update_job_run") return Promise.resolve({ error: null });
      if (name === "get_next_alerts") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { runSendAlerts } = await import("./sendAlertsRunner");
    const result = await runSendAlerts();

    expect(result).toEqual({ processed: 0, notificationsSent: 0 });
    expect(mockLogger.info).toHaveBeenCalledWith("[sendAlerts] Checking alert queue for pending dispatches");
  });

  it("should skip alerts with missing product", async () => {
    const mockAlerts = [
      {
        id: 1,
        product_id: 1,
        subscriber_id: 1,
        old_price: 100.0,
        new_price: 89.99,
        discount_percent: 10.01,
        products: null,
        attempts: 0,
      },
    ];

    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") return Promise.resolve({ data: true, error: null });
      if (name === "release_job_lock") return Promise.resolve({ error: null });
      if (name === "insert_job_run") return Promise.resolve({ data: { id: 1 }, error: null });
      if (name === "update_job_run") return Promise.resolve({ error: null });
      if (name === "get_next_alerts") return Promise.resolve({ data: mockAlerts, error: null });
      if (name === "move_to_dead_letter") return Promise.resolve({ error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { runSendAlerts } = await import("./sendAlertsRunner");
    const result = await runSendAlerts();

    expect(result.processed).toBe(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("alert_queue");
  });

  it("should skip inactive subscribers", async () => {
    const mockAlerts = [
      {
        id: 1,
        product_id: 1,
        subscriber_id: 1,
        old_price: 100.0,
        new_price: 89.99,
        discount_percent: 10.01,
        products: {
          id: 1,
          name: "Test Product",
          slug: "test-product",
          category: "physical",
          image_url: "https://example.com/image.jpg",
        },
        attempts: 0,
      },
    ];

    const mockSubscriber = {
      id: 1,
      email: "test@example.com",
      is_active: false,
    };

    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") return Promise.resolve({ data: true, error: null });
      if (name === "release_job_lock") return Promise.resolve({ error: null });
      if (name === "insert_job_run") return Promise.resolve({ data: { id: 1 }, error: null });
      if (name === "update_job_run") return Promise.resolve({ error: null });
      if (name === "get_next_alerts") return Promise.resolve({ data: mockAlerts, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscriber, error: null }),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [mockSubscriber], error: null })),
      })) as any,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    const { runSendAlerts } = await import("./sendAlertsRunner");
    const result = await runSendAlerts();

    expect(result.processed).toBe(1);
    expect(mockNotificationClient.sendPush).not.toHaveBeenCalled();
    expect(mockNotificationClient.sendEmail).not.toHaveBeenCalled();
  });

  it("should send notifications for active subscribers", async () => {
    const mockAlerts = [
      {
        id: 1,
        product_id: 1,
        subscriber_id: 1,
        old_price: 100.0,
        new_price: 89.99,
        discount_percent: 10.01,
        products: {
          id: 1,
          name: "Test Product",
          slug: "test-product",
          category: "physical",
          image_url: "https://example.com/image.jpg",
        },
        attempts: 0,
      },
    ];

    const mockSubscriber = {
      id: 1,
      email: "test@example.com",
      push_subscription_id: "push-sub-123",
      is_active: true,
      dnd_enabled: false,
      dnd_start: null,
      dnd_end: null,
      digest_frequency: "immediate",
      last_notified_at: null,
    };

    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") return Promise.resolve({ data: true, error: null });
      if (name === "release_job_lock") return Promise.resolve({ error: null });
      if (name === "insert_job_run") return Promise.resolve({ data: { id: 1 }, error: null });
      if (name === "update_job_run") return Promise.resolve({ error: null });
      if (name === "get_next_alerts") return Promise.resolve({ data: mockAlerts, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscriber, error: null }),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [mockSubscriber], error: null })),
      })) as any,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    const { runSendAlerts } = await import("./sendAlertsRunner");
    const result = await runSendAlerts();

    expect(mockNotificationClient.sendPush).toHaveBeenCalledWith(
      "push-sub-123",
      expect.objectContaining({
        title: expect.stringContaining("Test Product"),
        url: "https://thinkabell.click/deal/test-product",
      }),
    );
    expect(mockNotificationClient.sendEmail).toHaveBeenCalledWith(
      "test@example.com",
      expect.objectContaining({
        subject: expect.stringContaining("Test Product"),
      }),
    );
    expect(result.notificationsSent).toBe(2);
  });

  it("should reschedule alerts during DND", async () => {
    const mockAlerts = [
      {
        id: 1,
        product_id: 1,
        subscriber_id: 1,
        old_price: 100.0,
        new_price: 89.99,
        discount_percent: 10.01,
        products: {
          id: 1,
          name: "Test Product",
          slug: "test-product",
          category: "physical",
        },
        attempts: 0,
      },
    ];

    const mockSubscriber = {
      id: 1,
      email: "test@example.com",
      is_active: true,
      dnd_enabled: true,
      dnd_start: "00:00",
      dnd_end: "23:59",
      digest_frequency: "immediate",
      last_notified_at: null,
    };

    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") return Promise.resolve({ data: true, error: null });
      if (name === "release_job_lock") return Promise.resolve({ error: null });
      if (name === "insert_job_run") return Promise.resolve({ data: { id: 1 }, error: null });
      if (name === "update_job_run") return Promise.resolve({ error: null });
      if (name === "get_next_alerts") return Promise.resolve({ data: mockAlerts, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscriber, error: null }),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [mockSubscriber], error: null })),
      })) as any,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    const { runSendAlerts } = await import("./sendAlertsRunner");
    const result = await runSendAlerts();

    expect(result.notificationsSent).toBe(0);
    expect(mockSupabase.from).toHaveBeenCalledWith("alert_queue");
  });

  it("should decrypt subscriber PII before dispatch", async () => {
    const mockAlerts = [
      {
        id: 1,
        product_id: 1,
        subscriber_id: 1,
        old_price: 100.0,
        new_price: 89.99,
        discount_percent: 10.01,
        products: {
          id: 1,
          name: "Test Product",
          slug: "test-product",
          category: "physical",
          image_url: null,
        },
        attempts: 0,
      },
    ];

    const mockSubscriber = {
      id: 1,
      email: "encrypted-email-ciphertext",
      push_subscription_id: "encrypted-push-ciphertext",
      is_active: true,
      dnd_enabled: false,
      dnd_start: null,
      dnd_end: null,
      digest_frequency: "immediate",
      last_notified_at: null,
    };

    mockDecryptField.mockImplementation(async (value: string | null | undefined) => {
      if (value === "encrypted-email-ciphertext") return "plain@example.com";
      if (value === "encrypted-push-ciphertext") return "plain-push-id";
      return value ?? null;
    });

    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") return Promise.resolve({ data: true, error: null });
      if (name === "release_job_lock") return Promise.resolve({ error: null });
      if (name === "insert_job_run") return Promise.resolve({ data: { id: 1 }, error: null });
      if (name === "update_job_run") return Promise.resolve({ error: null });
      if (name === "get_next_alerts") return Promise.resolve({ data: mockAlerts, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [mockSubscriber], error: null })),
      })) as any,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    const { runSendAlerts } = await import("./sendAlertsRunner");
    const result = await runSendAlerts();

    expect(mockNotificationClient.sendEmail).toHaveBeenCalledWith(
      "plain@example.com",
      expect.objectContaining({ subject: expect.stringContaining("Test Product") }),
    );
    expect(mockNotificationClient.sendPush).toHaveBeenCalledWith("plain-push-id", expect.anything());
    expect(result.notificationsSent).toBe(2);
  });

  it("should isolate undecryptable subscribers instead of failing the run", async () => {
    const mockAlerts = [
      {
        id: 1,
        product_id: 1,
        subscriber_id: 1,
        old_price: 100.0,
        new_price: 89.99,
        discount_percent: 10.01,
        products: {
          id: 1,
          name: "Test Product",
          slug: "test-product",
          category: "physical",
          image_url: null,
        },
        attempts: 0,
      },
    ];

    const mockSubscriber = {
      id: 1,
      email: "corrupted-ciphertext",
      push_subscription_id: "corrupted-push",
      is_active: true,
      dnd_enabled: false,
      dnd_start: null,
      dnd_end: null,
      digest_frequency: "immediate",
      last_notified_at: null,
    };

    mockDecryptField.mockRejectedValue(new Error("GCM auth failure"));

    mockSupabase.rpc.mockImplementation((name: string) => {
      if (name === "try_acquire_job_lock") return Promise.resolve({ data: true, error: null });
      if (name === "release_job_lock") return Promise.resolve({ error: null });
      if (name === "insert_job_run") return Promise.resolve({ data: { id: 1 }, error: null });
      if (name === "update_job_run") return Promise.resolve({ error: null });
      if (name === "get_next_alerts") return Promise.resolve({ data: mockAlerts, error: null });
      if (name === "move_to_dead_letter") return Promise.resolve({ error: null });
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [mockSubscriber], error: null })),
      })) as any,
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    const { runSendAlerts } = await import("./sendAlertsRunner");
    const result = await runSendAlerts();

    // Run completes without throwing; the undecryptable subscriber gets no
    // channels and the alert is retried via the failure path.
    expect(result.processed).toBe(1);
    expect(result.notificationsSent).toBe(0);
    expect(mockNotificationClient.sendEmail).not.toHaveBeenCalled();
    expect(mockNotificationClient.sendPush).not.toHaveBeenCalled();
  });
});
