# ThinkaBell Testing Guide

## Overview

This document outlines the testing strategy, patterns, and best practices for the ThinkaBell codebase.

## Test Structure

The project uses **Vitest** as the test runner across all packages. Tests are colocated with source files using the `.test.ts` extension.

```
packages/
  config/src/           # Configuration tests
  database/src/         # Database client and repository tests
    repositories/
      productRepository.test.ts
      priceHistoryRepository.test.ts
      subscriberRepository.test.ts
      alertRepository.test.ts
      retailerLinkRepository.test.ts
    client.test.ts
  shared/src/           # Shared utilities and API client tests
    api/
      amazonClient.test.ts
      ebayClient.test.ts
      walmartClient.test.ts
      notificationClient.test.ts
    utils/
      retry.test.ts
      circuitBreaker.test.ts
      rateLimit.test.ts
      redis.test.ts
      logger.test.ts

apps/
  jobs/src/jobs/        # Background job tests
    fetchPricesRunner.test.ts
    sendAlertsRunner.test.ts
  web/app/api/          # API route tests
    retailer-links/route.test.ts
    retailer-links/sponsored/route.test.ts
    retailer-links/[id]/click/route.test.ts
```

## Running Tests

```bash
# Run all tests
pnpm run test

# Run tests for a specific package
pnpm run test --filter=@thinkabell/shared
pnpm run test --filter=@thinkabell/database
pnpm run test --filter=@thinkabell/jobs

# Run tests in a specific directory
cd apps/jobs && npx vitest run
cd apps/web && npx vitest run
```

## Test Patterns

### 1. Repository Tests

Repositories are tested using mocked Supabase clients. The mock pattern uses a chainable mock builder:

```typescript
function createChainableMock(terminalReturn: any) {
  const chain: any = {};
  const methods = ["select", "eq", "update", "insert", "order", "limit", "single", "maybeSingle", "or", "then"];
  for (const method of methods) {
    if (method === "then") {
      chain[method] = (onFulfilled: any) => {
        return Promise.resolve({ data: terminalReturn.data ?? terminalReturn, error: terminalReturn.error ?? null }).then(onFulfilled);
      };
    } else {
      chain[method] = vi.fn(() => {
        if (method === "single" || method === "maybeSingle") {
          return terminalReturn;
        }
        return chain;
      });
    }
  }
  return chain;
}
```

### 2. API Client Tests

API clients are tested with mocked `fetch` and environment variables:

```typescript
vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Test with credentials
vi.resetModules();
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({}),
} as unknown as Response);

const { amazonClient } = await import("./amazonClient");
await amazonClient.getPrice("B0TEST");
```

### 3. Job Runner Tests

Job runners are tested with mocked dependencies:

```typescript
vi.mock("@thinkabell/database", () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
  ProductRepository: mockProductRepository,
  SubscriberRepository: mockSubscriberRepository,
}));

vi.mock("@thinkabell/shared", () => ({
  amazonClient: mockAmazonClient,
  redis: mockRedis,
  logger: mockLogger,
}));
```

### 4. API Route Tests

API routes are tested by calling the route handlers directly:

```typescript
const { GET } = await import("./route");
const request = new Request("http://localhost:3000/api/retailer-links?productId=1");
const response = await GET(request);
const data = await response.json();

expect(response.status).toBe(200);
expect(Array.isArray(data)).toBe(true);
```

## Mocking Best Practices

1. **Use `vi.fn()` for all mock functions** - ensures proper spy behavior
2. **Clear mocks between tests** - use `beforeEach(() => { vi.clearAllMocks(); })`
3. **Restore mocks after tests** - use `afterEach(() => { vi.restoreAllMocks(); })`
4. **Mock at the module level** - use `vi.mock()` at the top of the test file
5. **Use `vi.hoisted()` for shared mock state** - when multiple mocks need to share state

## Coverage Requirements

The project maintains a minimum coverage threshold of 70% for:
- Lines
- Functions
- Branches
- Statements

Run coverage report:
```bash
pnpm run test --coverage
```

## Integration Tests

Integration tests verify the interaction between multiple components:

- **fetchPricesRunner** - Tests price fetching, product updates, and alert queueing
- **sendAlertsRunner** - Tests notification dispatch with DND, digest, and dead-letter handling
- **API Routes** - Tests HTTP endpoints with mocked database

## E2E Testing (Future)

For end-to-end testing, consider using:
- Playwright or Cypress for browser automation
- Test the full flow: subscribe → price drop → notification received

## CI/CD Integration

Tests run automatically on:
- Pull requests to `main`
- Pushes to `main`

The CI pipeline runs:
1. Type checking (`pnpm run type-check`)
2. Linting (`pnpm run lint`)
3. Unit tests (`pnpm run test`)
4. Build verification (`pnpm run build`)

## Writing New Tests

When adding new features:

1. **Write tests first** (TDD approach)
2. **Test happy path** - normal operation
3. **Test error cases** - API failures, database errors
4. **Test edge cases** - empty arrays, null values, boundary conditions
5. **Keep tests isolated** - each test should be independent
6. **Use descriptive test names** - `should [behavior] when [condition]`

Example:
```typescript
it("should queue alerts for subscribers when discount >= 5%", async () => {
  // Arrange
  const mockProducts = [{ id: 1, amazon_asin: "B0TEST", current_price: 100.0 }];
  mockProductRepository.getTrackableProducts.mockResolvedValue(mockProducts);
  mockAmazonClient.getPrice.mockResolvedValue(89.99);
  
  // Act
  const result = await runFetchPrices();
  
  // Assert
  expect(result.alertsQueued).toBeGreaterThan(0);
});
```

## Debugging Tests

To debug a failing test:
1. Check the error message for the exact assertion that failed
2. Use `console.log` to inspect mock call arguments
3. Verify mock implementations match expected behavior
4. Check that mocked return values have the correct shape

## Common Pitfalls

1. **Forgot to return chain from mock methods** - ensure `eq`, `select`, etc. return the chain object
2. **Incorrect mock return types** - mocks should return promises for async operations
3. **Shared mock state** - clear mocks between tests to avoid test pollution
4. **Missing exports in module mocks** - ensure all used exports are included in `vi.mock()`
