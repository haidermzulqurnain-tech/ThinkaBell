import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      then: vi.fn((onFulfilled) => Promise.resolve({ error: null }).then(onFulfilled)),
    })),
  })),
  rpc: vi.fn(),
};

vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}));

describe("Click Tracking API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnValue({
      insert: vi.fn(() => ({
        then: vi.fn((onFulfilled) => Promise.resolve({ error: null }).then(onFulfilled)),
      })),
    });
    mockSupabase.rpc.mockResolvedValue({ error: null });
  });

  describe("POST /api/retailer-links/[id]/click", () => {
    it("should record a click successfully", async () => {
      const { POST } = await import("./route");
      const request = new Request("http://localhost:3000/api/retailer-links/1/click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.100",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });
      const response = await POST(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          then: vi.fn((onFulfilled) => Promise.resolve({ error: { message: "DB error" } }).then(onFulfilled)),
        })),
      });

      const { POST } = await import("./route");
      const request = new Request("http://localhost:3000/api/retailer-links/1/click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.100",
          "user-agent": "Mozilla/5.0",
        },
      });
      const response = await POST(request, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("DB error");
    });
  });
});
