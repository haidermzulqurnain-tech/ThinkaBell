import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const deadLetters = [
  {
    id: 1,
    product_id: 10,
    subscriber_id: 20,
    old_price: 100.0,
    new_price: 89.99,
    discount_percent: 10.01,
    attempts: 5,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    product_id: 11,
    subscriber_id: 21,
    old_price: 50.0,
    new_price: 40.0,
    discount_percent: 20.0,
    attempts: 5,
    created_at: new Date().toISOString(),
  },
];

function buildSupabase(options: {
  lock?: boolean;
  deadLetters?: unknown[];
  queryError?: unknown;
  insertError?: unknown;
}) {
  const rpc = vi.fn((name: string) => {
    if (name === "try_acquire_job_lock") {
      return Promise.resolve({ data: options.lock !== false, error: null });
    }
    if (name === "release_job_lock") {
      return Promise.resolve({ error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const insert = vi.fn((row: unknown) => Promise.resolve({ error: options.insertError ?? null }));
  const deleteEq = vi.fn(() => Promise.resolve({ error: null }));

  const from = vi.fn((table: string) => {
    if (table === "alert_dead_letter") {
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve({ data: options.queryError ? null : options.deadLetters ?? [], error: options.queryError ?? null }),
            ),
          })),
        })),
        delete: vi.fn(() => ({ eq: deleteEq })),
      };
    }
    if (table === "alert_queue") {
      return { insert };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { rpc, from, insert, deleteEq };
}

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: vi.fn(),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@thinkabell/shared", () => ({
  logger: mockLogger,
}));

async function setClient(client: ReturnType<typeof buildSupabase>) {
  const { getSupabaseServiceClient } = await import("@thinkabell/database");
  (getSupabaseServiceClient as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(client);
}

describe("runDeadLetterRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should exit early when the job lock cannot be acquired", async () => {
    const client = buildSupabase({ lock: false, deadLetters: [] });
    await setClient(client);

    const { runDeadLetterRetry } = await import("./deadLetterRetryRunner");
    const result = await runDeadLetterRetry();

    expect(result).toEqual({ retried: 0, succeeded: 0 });
    expect(client.rpc).toHaveBeenCalledWith("try_acquire_job_lock", { lock_id: 1003 });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalledWith("release_job_lock", { lock_id: 1003 });
  });

  it("should return zeros when the dead letter queue is empty", async () => {
    const client = buildSupabase({ deadLetters: [] });
    await setClient(client);

    const { runDeadLetterRetry } = await import("./deadLetterRetryRunner");
    const result = await runDeadLetterRetry();

    expect(result).toEqual({ retried: 0, succeeded: 0 });
    expect(client.rpc).toHaveBeenCalledWith("release_job_lock", { lock_id: 1003 });
  });

  it("should re-queue each dead letter and remove it from the queue", async () => {
    const client = buildSupabase({ deadLetters });
    await setClient(client);

    const { runDeadLetterRetry } = await import("./deadLetterRetryRunner");
    const result = await runDeadLetterRetry();

    expect(result).toEqual({ retried: 2, succeeded: 2 });
    expect(client.insert).toHaveBeenCalledTimes(2);
    const firstInsert = client.insert.mock.calls[0]![0] as Record<string, unknown>;
    expect(firstInsert.product_id).toBe(10);
    expect(firstInsert.subscriber_id).toBe(20);
    expect(firstInsert.sent).toBe(false);
    expect(firstInsert.attempts).toBe(0);
    expect(client.deleteEq).toHaveBeenCalledWith("id", 1);
    expect(client.deleteEq).toHaveBeenCalledWith("id", 2);
    expect(client.rpc).toHaveBeenCalledWith("release_job_lock", { lock_id: 1003 });
  });

  it("should keep a dead letter when the re-queue insert fails", async () => {
    const client = buildSupabase({
      deadLetters,
      insertError: { message: "constraint violation" },
    });
    await setClient(client);

    const { runDeadLetterRetry } = await import("./deadLetterRetryRunner");
    const result = await runDeadLetterRetry();

    expect(result).toEqual({ retried: 2, succeeded: 0 });
    // No row may be deleted from the dead letter queue when its re-queue failed.
    expect(client.deleteEq).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should rethrow a dead letter queue query error after releasing the lock", async () => {
    const client = buildSupabase({ queryError: { message: "db error" } });
    await setClient(client);

    const { runDeadLetterRetry } = await import("./deadLetterRetryRunner");
    await expect(runDeadLetterRetry()).rejects.toEqual({ message: "db error" });
    expect(client.rpc).toHaveBeenCalledWith("release_job_lock", { lock_id: 1003 });
  });
});

