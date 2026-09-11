export interface Env {}

interface CloudflareRequestData {
  country?: string;
  city?: string;
  region?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cf = (request as any).cf as CloudflareRequestData | undefined;
    const country = cf?.country || "US";

    // 1. Edge Affiliate Dynamic Geo-Redirect: /go/amazon/:asin
    if (url.pathname.startsWith("/go/amazon/")) {
      const asin = url.pathname.replace("/go/amazon/", "").split("/")[0];
      if (asin) {
        const regionalStores: Record<string, { domain: string; tag: string }> = {
          US: { domain: "www.amazon.com", tag: "thinkabell-20" },
          GB: { domain: "www.amazon.co.uk", tag: "thinkabell-uk-21" },
          DE: { domain: "www.amazon.de", tag: "thinkabell-de-21" },
          CA: { domain: "www.amazon.ca", tag: "thinkabell-ca-20" },
        };

        const store = regionalStores[country] || regionalStores["US"]!;
        const targetUrl = `https://${store.domain}/dp/${asin}?tag=${store.tag}&linkCode=osi&th=1&psc=1`;

        return Response.redirect(targetUrl, 302);
      }
    }

    // 2. Clone headers and inject edge geolocation
    const newHeaders = new Headers(request.headers);
    newHeaders.set("x-thinkabell-country", country);
    if (cf?.city) {
      newHeaders.set("x-thinkabell-city", cf.city);
    }

    const modifiedRequest = new Request(request, {
      headers: newHeaders,
    });

    // 3. Fetch from Hostinger origin
    const response = await fetch(modifiedRequest);

    // 4. Augment response with security and caching metadata
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("X-Edge-Served-By", "Cloudflare-Worker");
    responseHeaders.set("X-Detected-Country", country);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
