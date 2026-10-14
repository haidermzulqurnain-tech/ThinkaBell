/**
 * @file packages/config/src/env.test.ts
 * @description Unit tests for environment variable validation and access
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Config: Environment Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("envSchema validation", () => {
    it("should parse with default values when no env vars provided", async () => {
      const { envSchema } = await import("./env");
      const result = envSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe("development");
        expect(result.data.PORT).toBe(3000);
        expect(result.data.NEXT_PUBLIC_APP_URL).toBe("https://thinkabell.click");
        expect(result.data.AMAZON_PARTNER_TAG).toBe("");
        expect(result.data.AMAZON_PARTNER_TAG_UK).toBe("");
        expect(result.data.AMAZON_PARTNER_TAG_DE).toBe("");
        expect(result.data.AMAZON_PARTNER_TAG_CA).toBe("");
        expect(result.data.AMAZON_LIST_URLS).toBe("");
        expect(result.data.AMAZON_LIST_MARKETPLACE).toBe("US");
        expect(result.data.AMAZON_LIST_MAX_ITEMS).toBe(100);
        expect(result.data.AMAZON_LIST_FETCH_DELAY_MS).toBe(1000);
        expect(result.data.AMAZON_REGION).toBe("us-east-1");
      }
    });

    it("should parse custom values from process.env", async () => {
      const { envSchema } = await import("./env");
      const result = envSchema.safeParse({
        NODE_ENV: "production",
        PORT: "4000",
        NEXT_PUBLIC_APP_URL: "https://custom.example.com",
        AMAZON_PARTNER_TAG: "my-custom-tag",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe("production");
        expect(result.data.PORT).toBe(4000);
        expect(result.data.NEXT_PUBLIC_APP_URL).toBe("https://custom.example.com");
        expect(result.data.AMAZON_PARTNER_TAG).toBe("my-custom-tag");
      }
    });

    it("should reject invalid NODE_ENV values", async () => {
      const { envSchema } = await import("./env");
      const result = envSchema.safeParse({ NODE_ENV: "invalid" });
      expect(result.success).toBe(false);
    });

    it("should coerce PORT string to number", async () => {
      const { envSchema } = await import("./env");
      const result = envSchema.safeParse({ PORT: "8080" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(8080);
        expect(typeof result.data.PORT).toBe("number");
      }
    });

    it("should accept empty strings for optional API keys", async () => {
      const { envSchema } = await import("./env");
      const result = envSchema.safeParse({
        AMAZON_ACCESS_KEY: "",
        AMAZON_SECRET_KEY: "",
        EBAY_CLIENT_ID: "",
        EBAY_CLIENT_SECRET: "",
      });
      expect(result.success).toBe(true);
    });

    it("should validate NEXT_PUBLIC_APP_URL as URL", async () => {
      const { envSchema } = await import("./env");
      const result = envSchema.safeParse({
        NEXT_PUBLIC_APP_URL: "not-a-valid-url",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid URL for NEXT_PUBLIC_APP_URL", async () => {
      const { envSchema } = await import("./env");
      const result = envSchema.safeParse({
        NEXT_PUBLIC_APP_URL: "https://valid.example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should provide defaults for all required fields", async () => {
      const { envSchema } = await import("./env");
      const parsed = envSchema.parse({});
      expect(parsed).toHaveProperty("NODE_ENV");
      expect(parsed).toHaveProperty("PORT");
      expect(parsed).toHaveProperty("NEXT_PUBLIC_APP_URL");
      expect(parsed).toHaveProperty("SUPABASE_URL");
      expect(parsed).toHaveProperty("SUPABASE_ANON_KEY");
      expect(parsed).toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
      expect(parsed).toHaveProperty("AMAZON_PARTNER_TAG");
      expect(parsed).toHaveProperty("AMAZON_REGION");
      expect(parsed).toHaveProperty("CRON_SECRET");
    });
  });

  describe("getEnv() function", () => {
    it("should return cached env on subsequent calls", async () => {
      const { getEnv } = await import("./env");
      const env1 = getEnv();
      const env2 = getEnv();
      expect(env1).toBe(env2);
    });

    it("should return an object with all expected keys", async () => {
      const { getEnv } = await import("./env");
      const result = getEnv();
      expect(result).toHaveProperty("NODE_ENV");
      expect(result).toHaveProperty("SUPABASE_URL");
      expect(result).toHaveProperty("AMAZON_PARTNER_TAG");
      expect(result).toHaveProperty("UPSTASH_REDIS_REST_URL");
    });

    it("should handle missing environment variables gracefully", async () => {
      // Set NODE_ENV to development for this test
      process.env.NODE_ENV = "development";
      process.env = {};
      const { getEnv } = await import("./env");
      const result = getEnv();
      expect(result.NODE_ENV).toBe("development");
      expect(result.PORT).toBe(3000);
    });
  });

  describe("field isolation", () => {
    /**
     * A project ref and key shaped like the real thing, so these fixtures pass
     * the shape validation that the placeholder values they replace would not.
     */
    const REAL_URL = "https://abcdefghijklmnopqrst.supabase.co";
    const REAL_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature";

    /**
     * Regression: getEnv() used to parse the whole object at once and, on any
     * failure, fall back to envSchema.parse({}) — which replaced every value
     * the host delivered with its default. One malformed variable (an app URL
     * missing its scheme, a non-numeric PORT, a malformed sender email)
     * therefore wiped the Supabase credentials, leaving the app silently
     * disconnected while the host served them.
     */
    it("keeps Supabase credentials when a sibling variable is invalid", async () => {
      process.env = {
        SUPABASE_URL: REAL_URL,
        SUPABASE_ANON_KEY: REAL_KEY,
        SUPABASE_SERVICE_ROLE_KEY: REAL_KEY.replace("anon", "service"),
        NEXT_PUBLIC_APP_URL: "thinkabell.click",
      };
      const { getEnv } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe(REAL_URL);
      expect(getEnv().SUPABASE_ANON_KEY).toBe(REAL_KEY);
      expect(getEnv().SUPABASE_SERVICE_ROLE_KEY).toBe(REAL_KEY.replace("anon", "service"));
      // The invalid field falls back to its own default.
      expect(getEnv().NEXT_PUBLIC_APP_URL).toBe("https://thinkabell.click");
    });

    it("keeps valid credentials when an unrelated variable is not a number", async () => {
      process.env = {
        SUPABASE_URL: REAL_URL,
        SUPABASE_ANON_KEY: REAL_KEY,
        PORT: "not-a-port",
      };
      const { getEnv } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe(REAL_URL);
      expect(getEnv().PORT).toBe(3000);
    });

    it("reports the rejected variable by name without logging its value", async () => {
      process.env = {
        SUPABASE_URL: REAL_URL,
        SUPABASE_ANON_KEY: REAL_KEY,
        NEXT_PUBLIC_APP_URL: "thinkabell.click",
      };
      const { getEnvIssues } = await import("./env");
      const issues = getEnvIssues();

      expect(issues).toHaveLength(1);
      const issue = issues[0];
      expect(issue).toBeDefined();
      expect(issue?.variable).toBe("NEXT_PUBLIC_APP_URL");
      expect(issue?.delivered).toBe(true);
      // The reason must never carry the delivered value.
      expect(issue?.reason).not.toContain("thinkabell.click");
      expect(issue?.reason).not.toContain(REAL_KEY);
    });

    it("treats a blank value as unset instead of coercing it", async () => {
      process.env = { PORT: "", SUPABASE_URL: "" };
      const { getEnv } = await import("./env");

      // z.coerce.number() would otherwise turn "" into 0.
      expect(getEnv().PORT).toBe(3000);
      expect(getEnv().SUPABASE_URL).toBe("");
    });

    it("rejects a malformed Supabase URL so it cannot reach the client", async () => {
      process.env = { SUPABASE_URL: "project.supabase.co" };
      const { getEnv, getEnvIssues } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe("");
      expect(getEnvIssues().map((issue) => issue.variable)).toContain("SUPABASE_URL");
    });

    it("has no issues for a fully valid environment", async () => {
      process.env = {
        SUPABASE_URL: REAL_URL,
        SUPABASE_ANON_KEY: REAL_KEY,
        NEXT_PUBLIC_APP_URL: "https://thinkabell.click",
      };
      const { getEnvIssues } = await import("./env");

      expect(getEnvIssues()).toEqual([]);
    });

    it("keeps reporting issues after resetEnv", async () => {
      process.env = { NEXT_PUBLIC_APP_URL: "not-a-url" };
      const { getEnv, getEnvIssues, resetEnv } = await import("./env");

      getEnv();
      expect(getEnvIssues()).toHaveLength(1);

      resetEnv();
      expect(getEnvIssues()).toHaveLength(1);
    });
  });

  describe("Supabase credential shape", () => {
    /**
     * The values .env.example used to ship. They are non-empty, so the
     * fail-closed guard in packages/database passed them through, and the URL
     * is syntactically valid — so the client was built and pointed at a host
     * that does not exist. Hostinger then showed the connection as configured
     * while Supabase received no requests at all.
     */
    const PLACEHOLDER_URL = "https://your-project.supabase.co";
    const PLACEHOLDER_KEY = "your-supabase-anon-key";

    it("rejects the placeholder URL instead of pointing the client at it", async () => {
      process.env = { SUPABASE_URL: PLACEHOLDER_URL };
      const { getEnv, getEnvIssues } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe("");
      const issue = getEnvIssues().find((i) => i.variable === "SUPABASE_URL");
      expect(issue?.delivered).toBe(true);
    });

    it("rejects the placeholder key instead of sending it to Supabase", async () => {
      process.env = { SUPABASE_ANON_KEY: PLACEHOLDER_KEY };
      const { getEnv, getEnvIssues } = await import("./env");

      expect(getEnv().SUPABASE_ANON_KEY).toBe("");
      expect(getEnvIssues().map((i) => i.variable)).toContain("SUPABASE_ANON_KEY");
    });

    it("fails closed for the client-facing pair too", async () => {
      process.env = {
        NEXT_PUBLIC_SUPABASE_URL: PLACEHOLDER_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: PLACEHOLDER_KEY,
      };
      const { getEnv, getEnvIssues } = await import("./env");

      expect(getEnv().NEXT_PUBLIC_SUPABASE_URL).toBe("");
      expect(getEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("");
      expect(
        getEnvIssues()
          .map((i) => i.variable)
          .sort(),
      ).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
    });

    it("accepts the new-style sb_ publishable key", async () => {
      process.env = { SUPABASE_ANON_KEY: "sb_publishable_AbCdEf123456" };
      const { getEnv } = await import("./env");

      expect(getEnv().SUPABASE_ANON_KEY).toBe("sb_publishable_AbCdEf123456");
    });

    it("accepts a local Supabase CLI instance over http", async () => {
      process.env = { SUPABASE_URL: "http://127.0.0.1:54321" };
      const { getEnv } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe("http://127.0.0.1:54321");
    });
  });

  describe("fail-closed credentials", () => {
    /**
     * The health endpoint's `status` means "the app answers", not "every
     * integration is configured". Without reporting these separately an
     * operator reading only `healthy` cannot see that a revenue path or the PII
     * encryption is dead — which is exactly how AMAZON_PARTNER_TAG stayed unset
     * while the app looked fine.
     */
    it("reports every fail-closed credential as unset when the host has none of them", async () => {
      process.env = { NODE_ENV: "production" };
      const { getUnsetFailClosedCredentials } = await import("./env");
      const unset = getUnsetFailClosedCredentials();

      expect(unset.map((entry) => entry.variable)).toEqual([
        "AMAZON_PARTNER_TAG",
        "REVALIDATION_SECRET",
        "RETAILER_LINKS_API_KEY",
        "ENCRYPTION_KEY",
        "BLIND_INDEX_KEY",
        "AMAZON_LIST_URLS",
      ]);
      // Exactly the two PII controls are security-critical.
      expect(unset.filter((entry) => entry.security).map((entry) => entry.variable)).toEqual([
        "ENCRYPTION_KEY",
        "BLIND_INDEX_KEY",
      ]);
    });

    it("reports a credential as set once any of its names carries a value", async () => {
      process.env = { AMAZON_PARTNER_TAG: "thinkabell-20" };
      const { getUnsetFailClosedCredentials } = await import("./env");

      expect(getUnsetFailClosedCredentials().map((entry) => entry.variable)).not.toContain(
        "AMAZON_PARTNER_TAG",
      );
    });

    it("treats a blank value as unset, not as configured", async () => {
      process.env = { AMAZON_PARTNER_TAG: "" };
      const { getUnsetFailClosedCredentials } = await import("./env");

      expect(getUnsetFailClosedCredentials().map((entry) => entry.variable)).toContain(
        "AMAZON_PARTNER_TAG",
      );
    });

    it("gives each entry a purpose explaining the consequence", async () => {
      process.env = {};
      const { getUnsetFailClosedCredentials, FAIL_CLOSED_CREDENTIALS } = await import("./env");

      const unset = getUnsetFailClosedCredentials();
      expect(unset).toHaveLength(FAIL_CLOSED_CREDENTIALS.length);
      for (const entry of unset) {
        expect(entry.purpose.length).toBeGreaterThan(20);
      }
    });
  });

  describe("Sentry DSN shape (only valid DSNs are accepted)", () => {
    const REAL = [
      "https://abc123def456@o0.ingest.sentry.io/1234567",
      "https://abc123def456@o123456.ingest.sentry.io/1234567",
      "https://abc123def456@o550960.ingest.us.sentry.io/4507288890724352",
      "https://abc123def456@o550960.ingest.de.sentry.io/4507288890724352",
      "https://1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d@o1.ingest.sentry.io/6504691",
      "https://sentrykey123@sentry.mycompany.com/1",
      "https://abc123@eu.sentry.io/42",
    ];

    it.each(REAL)("accepts a real DSN: %s", async (dsn) => {
      process.env = { SENTRY_DSN: dsn };
      const { getEnv, getEnvIssues } = await import("./env");

      expect(getEnv().SENTRY_DSN).toBe(dsn);
      expect(getEnvIssues()).toEqual([]);
    });

    it("rejects only the placeholder, and reports why", async () => {
      process.env = { SENTRY_DSN: "https://your-sentry-dsn@ingest.sentry.io/0" };
      const { getEnv, getEnvIssues } = await import("./env");

      expect(getEnv().SENTRY_DSN).toBe("");
      const issue = getEnvIssues().find((i) => i.variable === "SENTRY_DSN");
      expect(issue?.delivered).toBe(true);
      expect(issue?.reason).toContain("not a valid Sentry DSN");
    });
  });

  describe("credential name aliases", () => {
    /**
     * The canonical names are the only ones the code and .env.example use, but
     * the same value has several widely-used spellings. A deployment using one
     * of those is indistinguishable from an unconfigured one, which is the
     * failure this resolves: non-empty on the host, empty to the schema.
     */
    const URL = "https://abcdefghijklmnopqrst.supabase.co";
    const KEY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature";

    it.each([
      ["SUPABASE_API_KEY", "SUPABASE_ANON_KEY"],
      ["NEXT_PUBLIC_SUPABASE_API_KEY", "SUPABASE_ANON_KEY"],
      ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"],
      ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"],
      ["NEXT_PUBLIC_SUPABASE_KEY", "SUPABASE_ANON_KEY"],
      ["NEXT_PUBLIC_ANON_KEY", "SUPABASE_ANON_KEY"],
      ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      ["SUPABASE_SECRET_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      ["SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    ])("resolves %s into %s", async (alias, canonical) => {
      process.env = { SUPABASE_URL: URL, [alias]: KEY };
      const { getEnv, getCredentialAliasesUsed } = await import("./env");

      expect(getEnv()[canonical as "SUPABASE_ANON_KEY"]).toBe(KEY);
      // Reported, not silently accepted, so the operator can normalise the name.
      expect(getCredentialAliasesUsed()).toEqual([{ canonical, alias }]);
    });

    it("resolves SUPABASE_PROJECT_URL into SUPABASE_URL", async () => {
      process.env = { SUPABASE_PROJECT_URL: URL, SUPABASE_ANON_KEY: KEY };
      const { getEnv, getCredentialAliasesUsed } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe(URL);
      expect(getCredentialAliasesUsed()).toEqual([
        { canonical: "SUPABASE_URL", alias: "SUPABASE_PROJECT_URL" },
      ]);
    });

    it("prefers a canonical variable over an alias of the same variable", async () => {
      process.env = {
        SUPABASE_URL: URL,
        SUPABASE_ANON_KEY: KEY,
        SUPABASE_API_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.should-not-win",
      };
      const { getEnv, getCredentialAliasesUsed } = await import("./env");

      expect(getEnv().SUPABASE_ANON_KEY).toBe(KEY);
      expect(getCredentialAliasesUsed()).toEqual([]);
    });

    it("reports no aliases when only canonical names are used", async () => {
      process.env = { SUPABASE_URL: URL, SUPABASE_ANON_KEY: KEY };
      const { getEnv, getCredentialAliasesUsed } = await import("./env");

      getEnv();
      expect(getCredentialAliasesUsed()).toEqual([]);
    });

    it("clears alias notes on resetEnv", async () => {
      process.env = { SUPABASE_URL: URL, SUPABASE_SECRET_KEY: KEY };
      const { getEnv, getCredentialAliasesUsed, resetEnv } = await import("./env");

      expect(getEnv().SUPABASE_SERVICE_ROLE_KEY).toBe(KEY);
      expect(getCredentialAliasesUsed()).toHaveLength(1);

      resetEnv();
      expect(getCredentialAliasesUsed()).toEqual([]);
    });

    it("prefers SUPABASE_PUBLISHABLE_KEY over the ambiguous SUPABASE_API_KEY", async () => {
      // Both are set on the live host. SUPABASE_PUBLISHABLE_KEY is by definition
      // the anonymous key in Supabase's key model; SUPABASE_API_KEY is a legacy
      // generic name that has held an anon key, a service-role key, and a
      // placeholder depending on who set it. The specific spelling must win.
      process.env = {
        SUPABASE_URL: URL,
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_theRightOne",
        SUPABASE_API_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.staleLegacyKey",
      };
      const { getEnv, getCredentialAliasesUsed } = await import("./env");

      expect(getEnv().SUPABASE_ANON_KEY).toBe("sb_publishable_theRightOne");
      expect(getCredentialAliasesUsed()).toEqual([
        { canonical: "SUPABASE_ANON_KEY", alias: "SUPABASE_PUBLISHABLE_KEY" },
      ]);
    });

    it("resolves IMPACT_ACCOUNT_ID into IMPACT_ACCOUNT_SID", async () => {
      process.env = { IMPACT_ACCOUNT_ID: "12345", IMPACT_API_KEY: "auth-token" };
      const { getEnv, getCredentialAliasesUsed } = await import("./env");

      expect(getEnv().IMPACT_ACCOUNT_SID).toBe("12345");
      expect(getCredentialAliasesUsed()).toEqual([
        { canonical: "IMPACT_ACCOUNT_SID", alias: "IMPACT_ACCOUNT_ID" },
        { canonical: "IMPACT_AUTH_TOKEN", alias: "IMPACT_API_KEY" },
      ]);
    });

    it("still rejects a placeholder supplied through an alias", async () => {
      // The alias resolves the name; shape validation still applies to the
      // value, so a placeholder is caught rather than pointed at.
      process.env = { SUPABASE_URL: "https://your-project.supabase.co" };
      const { getEnv, getEnvIssues } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe("");
      expect(getEnvIssues().map((issue) => issue.variable)).toContain("SUPABASE_URL");
    });
  });

  describe("Supabase URL shape (non-alias)", () => {
    it("accepts a custom domain fronting the Supabase gateway", async () => {
      process.env = { SUPABASE_URL: "https://api.example.com" };
      const { getEnv } = await import("./env");
      expect(getEnv().SUPABASE_URL).toBe("https://api.example.com");
    });

    it("rejects a remote http URL", async () => {
      process.env = { SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co" };
      const { getEnv } = await import("./env");
      expect(getEnv().SUPABASE_URL).toBe("");
    });
  });

  describe("env singleton", () => {
    it("should be the same instance as getEnv()", async () => {
      const { env, getEnv } = await import("./env");
      expect(env).toBe(getEnv());
    });

    it("should have all expected properties", async () => {
      const { env } = await import("./env");
      expect(env).toHaveProperty("NODE_ENV");
      expect(env).toHaveProperty("NEXT_PUBLIC_APP_URL");
      expect(env).toHaveProperty("SUPABASE_URL");
      expect(env).toHaveProperty("AMAZON_ACCESS_KEY");
      expect(env).toHaveProperty("AMAZON_SECRET_KEY");
      expect(env).toHaveProperty("AMAZON_PARTNER_TAG");
      expect(env).toHaveProperty("AMAZON_REGION");
      expect(env).toHaveProperty("EBAY_CLIENT_ID");
      expect(env).toHaveProperty("EBAY_CLIENT_SECRET");
      expect(env).toHaveProperty("EBAY_AFFILIATE_CAMPAIGN_ID");
      expect(env).toHaveProperty("AFFILIATE_ATTRIBUTION_ID");
      expect(env).toHaveProperty("ONESIGNAL_APP_ID");
      expect(env).toHaveProperty("ONESIGNAL_REST_API_KEY");
      expect(env).toHaveProperty("BREVO_API_KEY");
      expect(env).toHaveProperty("UPSTASH_REDIS_REST_URL");
      expect(env).toHaveProperty("UPSTASH_REDIS_REST_TOKEN");
      expect(env).toHaveProperty("SENTRY_DSN");
      expect(env).toHaveProperty("CRON_SECRET");
    });
  });

  describe("TypeScript types", () => {
    it("should infer correct types from schema", async () => {
      const { envSchema } = await import("./env");
      // Type-level test: these should compile
      const _typeCheck: {
        NODE_ENV: "development" | "production" | "test";
        PORT: number;
        NEXT_PUBLIC_APP_URL: string;
        AMAZON_PARTNER_TAG: string;
      } = {
        NODE_ENV: "development",
        PORT: 3000,
        NEXT_PUBLIC_APP_URL: "https://thinkabell.click",
        AMAZON_PARTNER_TAG: "thinkabell-20",
      };
      expect(_typeCheck).toBeDefined();
    });
  });
});
