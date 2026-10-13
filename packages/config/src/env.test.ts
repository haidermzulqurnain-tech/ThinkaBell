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
     * Regression: getEnv() used to parse the whole object at once and, on any
     * failure, fall back to envSchema.parse({}) — which replaced every value
     * the host delivered with its default. One malformed variable (an app URL
     * missing its scheme, a non-numeric PORT, a malformed sender email)
     * therefore wiped the Supabase credentials, leaving the app silently
     * disconnected while the host served them.
     */
    it("keeps Supabase credentials when a sibling variable is invalid", async () => {
      process.env = {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
        NEXT_PUBLIC_APP_URL: "thinkabell.click",
      };
      const { getEnv } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe("https://project.supabase.co");
      expect(getEnv().SUPABASE_ANON_KEY).toBe("anon-key");
      expect(getEnv().SUPABASE_SERVICE_ROLE_KEY).toBe("service-key");
      // The invalid field falls back to its own default.
      expect(getEnv().NEXT_PUBLIC_APP_URL).toBe("https://thinkabell.click");
    });

    it("keeps valid credentials when an unrelated variable is not a number", async () => {
      process.env = {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
        PORT: "not-a-port",
      };
      const { getEnv } = await import("./env");

      expect(getEnv().SUPABASE_URL).toBe("https://project.supabase.co");
      expect(getEnv().PORT).toBe(3000);
    });

    it("reports the rejected variable by name without logging its value", async () => {
      process.env = {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "super-secret-value",
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
      expect(issue?.reason).not.toContain("super-secret-value");
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
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
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
