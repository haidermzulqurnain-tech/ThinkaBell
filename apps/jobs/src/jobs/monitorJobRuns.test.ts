import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSendEmail = vi.fn();
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@thinkabell/shared", () => ({
  notificationClient: { sendEmail: mockSendEmail },
  logger: mockLogger,
}));

type Run = {
  id: number;
  job_name: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
  records_processed?: number | null;
  records_succeeded?: number | null;
  records_failed?: number | null;
  error_message?: string | null;
};

function buildSupabase(runs: Run[] | null, queryError?: unknown) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve({ data: runs, error: queryError ?? null }));
  return {
    from: vi.fn((table: string) => {
      if (table !== "job_runs") throw new Error(`unexpected table ${table}`);
      return chain;
    }),
    chain,
  };
}

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: () => (globalThis as Record<string, unknown>).__monitorSupabase,
}));

function setSupabase(supabase: ReturnType<typeof buildSupabase>) {
  (globalThis as Record<string, unknown>).__monitorSupabase = supabase;
}

const nowIso = () => new Date().toISOString();

describe("runJobRunMonitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return zero alerts when no failed or partial runs exist", async () => {
    const supabase = buildSupabase([]);
    setSupabase(supabase);

    const { runJobRunMonitoring } = await import("./monitorJobRuns");
    const result = await runJobRunMonitoring();

    expect(result).toEqual({ alerted: 0 });
    expect(supabase.chain.in).toHaveBeenCalledWith("status", ["failed", "partial"]);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should rethrow a job_runs query error", async () => {
    const supabase = buildSupabase(null, { message: "db error" });
    setSupabase(supabase);

    const { runJobRunMonitoring } = await import("./monitorJobRuns");
    await expect(runJobRunMonitoring()).rejects.toEqual({ message: "db error" });
  });

  it("should email ops for a failed run", async () => {
    const supabase = buildSupabase([
      {
        id: 10,
        job_name: "fetch-prices",
        status: "failed",
        started_at: nowIso(),
        error_message: "boom",
      },
    ]);
    setSupabase(supabase);

    const { runJobRunMonitoring } = await import("./monitorJobRuns");
    const result = await runJobRunMonitoring();

    expect(result).toEqual({ alerted: 1 });
    expect(mockSendEmail).toHaveBeenCalledWith("ops@thinkabell.click", {
      subject: "ThinkaBell Job Alert: fetch-prices failed",
      body: expect.stringContaining("Job: fetch-prices"),
    });
    expect(mockSendEmail.mock.calls[0]![1].body).toContain("Error: boom");
  });

  it("should alert on a partial run where every record failed", async () => {
    const supabase = buildSupabase([
      {
        id: 11,
        job_name: "send-alerts",
        status: "partial",
        started_at: nowIso(),
        records_processed: 10,
        records_succeeded: 0,
        records_failed: 10,
      },
    ]);
    setSupabase(supabase);

    const { runJobRunMonitoring } = await import("./monitorJobRuns");
    const result = await runJobRunMonitoring();

    expect(result).toEqual({ alerted: 1 });
  });

  it("should not alert on a healthy partial run", async () => {
    const supabase = buildSupabase([
      {
        id: 12,
        job_name: "send-alerts",
        status: "partial",
        started_at: nowIso(),
        records_processed: 10,
        records_succeeded: 10,
        records_failed: 0,
      },
    ]);
    setSupabase(supabase);

    const { runJobRunMonitoring } = await import("./monitorJobRuns");
    const result = await runJobRunMonitoring();

    expect(result).toEqual({ alerted: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should alert when a partial run has more than half of its records failed", async () => {
    const supabase = buildSupabase([
      {
        id: 13,
        job_name: "send-alerts",
        status: "partial",
        started_at: nowIso(),
        records_processed: 10,
        records_succeeded: 4,
        records_failed: 6,
      },
    ]);
    setSupabase(supabase);

    const { runJobRunMonitoring } = await import("./monitorJobRuns");
    const result = await runJobRunMonitoring();

    expect(result).toEqual({ alerted: 1 });
  });

  it("should tolerate send failures without failing the run", async () => {
    mockSendEmail.mockImplementation(async () => {
      throw new Error("brevo down");
    });
    const supabase = buildSupabase([
      {
        id: 14,
        job_name: "fetch-prices",
        status: "failed",
        started_at: nowIso(),
      },
    ]);
    setSupabase(supabase);

    const { runJobRunMonitoring } = await import("./monitorJobRuns");
    const result = await runJobRunMonitoring();

    expect(result).toEqual({ alerted: 0 });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should not count an alert when the provider reports failure", async () => {
    mockSendEmail.mockResolvedValue(false);
    const supabase = buildSupabase([
      {
        id: 15,
        job_name: "fetch-prices",
        status: "failed",
        started_at: nowIso(),
      },
    ]);
    setSupabase(supabase);

    const { runJobRunMonitoring } = await import("./monitorJobRuns");
    const result = await runJobRunMonitoring();

    expect(result).toEqual({ alerted: 0 });
  });
});
