import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

interface TestEnv {
  ORIGIN_URL: string;
  AMAZON_US_TAG: string;
  AMAZON_GB_TAG: string;
  AMAZON_DE_TAG: string;
  AMAZON_CA_TAG: string;
  DEFAULT_COUNTRY?: string;
}

function createEnv(overrides: Partial<TestEnv> = {}): TestEnv {
  return {
    ORIGIN_URL: "https://origin.thinkabell.click",
    AMAZON_US_TAG: "thinkabell-us-20",
    AMAZON_GB_TAG: "thinkabell-uk-21",
    AMAZON_DE_TAG: "thinkabell-de-21",
    AMAZON_CA_TAG: "thinkabell-ca-20",
    ...overrides,
  };
}

function createRequest(
  path: string,
  cf?: { country?: string; city?: string },
  headers?: Record<string, string>,
): Request {
  const request = new Request(`https://thinkabell.click${path}`, { headers });
  if (cf) {
    (request as Request & { cf?: { country?: string; city?: string } }).cf = cf;
  }
  return request;
}

const noopContext = {} as ExecutionContext;

describe("edge-worker", () => {
  it("should export a fetch handler interface", async () => {
    const mod = await import("./index");
    expect(mod).toBeDefined();
    expect(typeof mod.default).toBe("object");
    expect(typeof mod.default.fetch).toBe("function");
  });

  describe("geo affiliate redirect (/go/amazon/:asin)", () => {
    it("redirects US visitors to amazon.com with the US tag", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW", { country: "US" }),
        createEnv(),
        noopContext,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://www.amazon.com/dp/B08N5WRWNW?tag=thinkabell-us-20&linkCode=osi&th=1&psc=1",
      );
    });

    it("redirects GB visitors to amazon.co.uk with the GB tag", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW", { country: "GB" }),
        createEnv(),
        noopContext,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://www.amazon.co.uk/dp/B08N5WRWNW?tag=thinkabell-uk-21&linkCode=osi&th=1&psc=1",
      );
    });

    it("redirects DE visitors to amazon.de with the DE tag", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW", { country: "DE" }),
        createEnv(),
        noopContext,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("www.amazon.de");
      expect(response.headers.get("location")).toContain("tag=thinkabell-de-21");
    });

    it("redirects CA visitors to amazon.ca with the CA tag", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW", { country: "CA" }),
        createEnv(),
        noopContext,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("www.amazon.ca");
      expect(response.headers.get("location")).toContain("tag=thinkabell-ca-20");
    });

    it("falls back to the US store for unlisted countries", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW", { country: "FR" }),
        createEnv(),
        noopContext,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("www.amazon.com");
      expect(response.headers.get("location")).toContain("tag=thinkabell-us-20");
    });

    it("defaults to the US store when Cloudflare provides no country", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW"),
        createEnv(),
        noopContext,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("www.amazon.com");
    });

    it("uses DEFAULT_COUNTRY when Cloudflare provides no country", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW"),
        createEnv({ DEFAULT_COUNTRY: "DE" }),
        noopContext,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("www.amazon.de");
    });

    it("returns 400 for an invalid ASIN", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/short", { country: "US" }),
        createEnv(),
        noopContext,
      );

      expect(response.status).toBe(400);
    });

    it("fails closed with 500 when the regional tag is not configured", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW", { country: "GB" }),
        createEnv({ AMAZON_GB_TAG: "" }),
        noopContext,
      );

      expect(response.status).toBe(500);
      expect(response.headers.get("location")).toBeNull();
    });

    it("fails closed with 500 when no tag is configured at all", async () => {
      const response = await worker.fetch(
        createRequest("/go/amazon/B08N5WRWNW", { country: "US" }),
        createEnv({ AMAZON_US_TAG: "" }),
        noopContext,
      );

      expect(response.status).toBe(500);
    });
  });

  describe("origin proxy pass-through", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue(
        new Response("origin-body", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("proxies requests to the configured origin with path and query", async () => {
      const response = await worker.fetch(
        createRequest("/deal/widget?utm=1", { country: "GB" }),
        createEnv(),
        noopContext,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const fetched = fetchMock.mock.calls[0]![0] as Request;
      expect(fetched.url).toBe("https://origin.thinkabell.click/deal/widget?utm=1");
      expect(fetched.headers.get("x-thinkabell-country")).toBe("GB");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("origin-body");
    });

    it("injects the detected city header when available", async () => {
      await worker.fetch(
        createRequest("/", { country: "GB", city: "London" }),
        createEnv(),
        noopContext,
      );

      const fetched = fetchMock.mock.calls[0]![0] as Request;
      expect(fetched.headers.get("x-thinkabell-city")).toBe("London");
    });

    it("overwrites client-supplied x-thinkabell headers to prevent spoofing", async () => {
      await worker.fetch(
        createRequest(
          "/",
          { country: "GB" },
          { "x-thinkabell-country": "JP", "x-thinkabell-city": "Tokyo" },
        ),
        createEnv(),
        noopContext,
      );

      const fetched = fetchMock.mock.calls[0]![0] as Request;
      expect(fetched.headers.get("x-thinkabell-country")).toBe("GB");
      expect(fetched.headers.get("x-thinkabell-city")).toBeNull();
    });

    it("augments the response with edge and security metadata", async () => {
      const response = await worker.fetch(
        createRequest("/", { country: "GB" }),
        createEnv(),
        noopContext,
      );

      expect(response.headers.get("X-Edge-Served-By")).toBe("Cloudflare-Worker");
      expect(response.headers.get("X-Detected-Country")).toBe("GB");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("content-type")).toBe("text/html");
    });

    it("fails closed with 503 when the origin URL is not configured", async () => {
      const response = await worker.fetch(
        createRequest("/", { country: "US" }),
        createEnv({ ORIGIN_URL: "" }),
        noopContext,
      );

      expect(response.status).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
