# Amazon Product Hunting — Manual List Curation

ThinkaBell hunts Amazon products through **manual data curation**:
a human curates public Amazon Lists in their own Amazon account,
and the `amazon-list` discovery source harvests those public list
pages. This document describes the model, its boundaries, and its
configuration.

## Why no automated login

Automated scraping of Amazon **with login credentials** (headless
browser login, session replay, credential storage) is explicitly
out of scope:

- It violates Amazon's [Conditions of Use](https://www.amazon.com/gp/help/customer/display.html?nodeId=508088)
  (no automated access to the service).
- Storing or reusing Amazon credentials creates a security exposure
  for the account holder.
- It risks permanent termination of the Amazon account.

The curated-list model keeps the platform inside acceptable use:
no credentials are requested, stored, or used anywhere in the
codebase, and no Amazon API is called by the hunting module.

## Data flow

1. **Curate** (manual): create/edit public Amazon Lists
   (wish lists / Listmania) in your own Amazon account.
2. **Configure**: add the public list URLs to `AMAZON_LIST_URLS`.
3. **Harvest**: the `product-discovery` job fetches each public
   list page sequentially, with retry/backoff and a configurable
   delay between fetches.
4. **Parse**: each item's ASIN, title, price, and image are
   extracted (regex-based, dependency-free; unknown layouts yield
   no items rather than errors).
5. **Generate affiliate links**: the modular
   `amazonAffiliateLinkGenerator` builds Associates links per
   marketplace from the configured partner tags.
6. **Persist**: items are upserted into `products`
   (`source = "amazon-list"`, `source_id = ASIN`) via
   `ProductRepository.upsertDiscoveredProducts`.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `AMAZON_LIST_URLS` | JSON array of `{ url, marketplace }` entries (public list URLs) | `""` (source disabled) |
| `AMAZON_LIST_MARKETPLACE` | Marketplace for items without an explicit one | `US` |
| `AMAZON_LIST_MAX_ITEMS` | Maximum items harvested per list | `100` |
| `AMAZON_LIST_FETCH_DELAY_MS` | Delay between consecutive list fetches | `1000` |
| `AMAZON_PARTNER_TAG` / `_UK` / `_DE` / `_CA` | Associates partner tags per marketplace | `""` (fail closed) |

Example:

```bash
AMAZON_LIST_URLS='[
  {"url": "https://www.amazon.com/hz/wishlist/ls/EXAMPLE", "marketplace": "US"},
  {"url": "https://www.amazon.co.uk/hz/wishlist/ls/EXAMPLE", "marketplace": "GB"}
]'

DISCOVERY_SOURCES='[
  {"name": "amazon-list", "type": "physical", "queries": [], "enabled": true}
]'
```

Optional `queries` entries act as case-insensitive title filters;
when omitted, every harvested item is kept.

## Fail-closed behavior

- **Missing partner tag**: the link generator throws instead of
  emitting an untagged or placeholder link. Harvested products
  still store their plain product URL, with
  `metadata.affiliateTagConfigured = false`.
- **Malformed `AMAZON_LIST_URLS`**: the source throws
  `AmazonListConfigError` (recorded as a run error).
- **Unreachable list**: the failure is logged and the remaining
  lists still harvest; the discovery run reports the error.
- **Invalid ASIN**: rejected by the link generator
  (`Invalid Amazon ASIN`).

## Rate limiting & reliability

- Sequential list fetches with `AMAZON_LIST_FETCH_DELAY_MS`
  between them (no concurrent hammering of Amazon).
- HTTP 429/5xx retried with exponential backoff (3 attempts).
- 15-second fetch timeout via `AbortSignal.timeout`.
- Circuit breaker (`discovery-amazon-list`) in the discovery
  runner opens after repeated failures.

## Module map

| Module | Responsibility |
| --- | --- |
| `packages/shared/src/api/amazonListClient.ts` | List config parsing, HTML parsing, list fetching |
| `packages/shared/src/api/amazonListSource.ts` | `ProductSource` implementation (search/price/details, dedupe, rate limiting) |
| `packages/shared/src/api/amazonAffiliateLinkGenerator.ts` | Modular, env-driven affiliate link generation (fail closed) |
| `apps/jobs/src/jobs/productDiscoveryRunner.ts` | Discovery orchestration (circuit breaker, advisory lock, job run tracking) |
