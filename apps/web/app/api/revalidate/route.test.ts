import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock("@thinkabell/config", () => ({
  env: { REVALIDATION_SECRET: "test-revalidation-secret" },
}));

describe("Revalidation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should revalidate valid paths with a valid bearer token", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-revalidation-secret",
      },
      body: JSON.stringify({ paths: ["/", "/deals"] }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.revalidated).toBe(2);
    expect(data.failed).toBe(0);
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
  });

  it("should return 401 without a bearer token", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["/"] }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should return 401 with an invalid bearer token", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-secret",
      },
      body: JSON.stringify({ paths: ["/"] }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should return 400 when paths is not an array", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-revalidation-secret",
      },
      body: JSON.stringify({ paths: "/" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("paths");
  });

  it("should reject absolute URLs and traversal paths but revalidate the rest", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-revalidation-secret",
      },
      body: JSON.stringify({
        paths: ["/deals", "https://evil.example.com", "/../admin", "/deal/[slug]"],
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.revalidated).toBe(2);
    expect(data.failed).toBe(2);
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
  });
});

