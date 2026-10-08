export interface Env {
  /**
   * Hostinger origin base URL the worker proxies traffic to
   * (e.g. https://thinkabell.click). Requests fail closed with 503 when unset.
   */
  ORIGIN_URL: string;
  /** Amazon affiliate tag for www.amazon.com (US). */
  AMAZON_US_TAG: string;
  /** Amazon affiliate tag for www.amazon.co.uk (GB). */
  AMAZON_GB_TAG: string;
  /** Amazon affiliate tag for www.amazon.de (DE). */
  AMAZON_DE_TAG: string;
  /** Amazon affiliate tag for www.amazon.ca (CA). */
  AMAZON_CA_TAG: string;
  /** Fallback country code when Cloudflare provides none. Defaults to "US". */
  DEFAULT_COUNTRY?: string;
}

interface CloudflareRequestData {
  country?: string;
  city?: string;
  region?: string;
}

interface RegionalStore {
  domain: string;
  tag: string;
}

const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;

function buildRegionalStores(env: Env): Record<string, RegionalStore> {
  return {
    US: { domain: "www.amazon.com", tag: env.AMAZON_US_TAG },
    GB: { domain: "www.amazon.co.uk", tag: env.AMAZON_GB_TAG },
    DE: { domain: "www.amazon.de", tag: env.AMAZON_DE_TAG },
    CA: { domain: "www.amazon.ca", tag: env.AMAZON_CA_TAG },
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cf = (request as Request & { cf?: CloudflareRequestData }).cf;
    const country = (cf?.country || env.DEFAULT_COUNTRY || "US").toUpperCase();

    // 1. Edge Affiliate Dynamic Geo-Redirect: /go/amazon/:asin
    if (url.pathname.startsWith("/go/amazon/")) {
      const asin = url.pathname.replace("/go/amazon/", "").split("/")[0] ?? "";
      if (!ASIN_PATTERN.test(asin)) {
        return new Response("Invalid Amazon ASIN", { status: 400 });
      }

      const stores = buildRegionalStores(env);
      const store = stores[country] ?? stores["US"];
      if (!store || !store.tag) {
        // Fail closed: never redirect with a missing or placeholder affiliate tag.
        return new Response(`Affiliate tag not configured for region ${country}`, {
          status: 500,
        });
      }

      const targetUrl = `https://${store.domain}/dp/${asin}?tag=${store.tag}&linkCode=osi&th=1&psc=1`;
      return Response.redirect(targetUrl, 302);
    }

    // 2. Proxy pass-through to the Hostinger origin
    if (!env.ORIGIN_URL) {
      return new Response("Origin URL not configured", { status: 503 });
    }

    const origin = new URL(env.ORIGIN_URL);
    const target = new URL(url.pathname + url.search, origin);

    // Inject edge geolocation derived from Cloudflare's cf data.
    // Client-supplied x-thinkabell-* headers are removed first so
    // downstream services can never be spoofed via request headers.
    const newHeaders = new Headers(request.headers);
    newHeaders.delete("host");
    newHeaders.delete("x-thinkabell-country");
    newHeaders.delete("x-thinkabell-city");
    newHeaders.set("x-thinkabell-country", country);
    if (cf?.city) {
      newHeaders.set("x-thinkabell-city", cf.city);
    }

    const modifiedRequest = new Request(target, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: "manual",
    });

    const response = await fetch(modifiedRequest);

    // 3. Augment response with security and edge metadata
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("X-Edge-Served-By", "Cloudflare-Worker");
    responseHeaders.set("X-Detected-Country", country);
    responseHeaders.set("X-Frame-Options", "DENY");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
