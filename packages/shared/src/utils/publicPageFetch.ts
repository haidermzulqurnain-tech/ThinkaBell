import { retryWithBackoff } from "./retry";

/**
 * Timeout for public-page fetches. Public deal catalogs
 * (Amazon lists, AppSumo browse) are not latency-critical,
 * so the timeout is generous but bounded.
 */
const FETCH_TIMEOUT_MS = 15000;

/**
 * Polite user agent identifying the harvester and the
 * project site, per the robots.txt convention for
 * automated readers of public pages.
 */
const USER_AGENT =
  "Mozilla/5.0 (compatible; ThinkaBellDealResearch/1.0; +https://thinkabell.click)";

export class PublicPageError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PublicPageError";
    this.status = status;
  }
}

/**
 * Fetches a public HTML page with a timeout, a polite
 * user agent, and bounded retries on transient failures.
 * Shared by every public-page harvester (Amazon lists,
 * AppSumo browse/product pages) so rate limiting,
 * timeouts, and retry behavior stay consistent.
 */
export async function fetchPublicPage(url: string): Promise<string> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
        },
      });

      if (!response.ok) {
        throw new PublicPageError(`HTTP ${response.status} fetching ${url}`, response.status);
      }

      return response.text();
    },
    {
      maxAttempts: 3,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    },
  );
}
