/**
 * @file packages/database/src/client.test.ts
 * @description Unit tests for Supabase client factory functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockCreateClient, mockEnv } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockEnv: {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  } as Record<string, string | undefined>,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

vi.mock("@thinkabell/config", () => ({
  env: mockEnv,
}));

describe("Database: Supabase Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.SUPABASE_URL = "https://test.supabase.co";
    mockEnv.SUPABASE_ANON_KEY = "test-anon-key";
    mockEnv.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mockEnv.NEXT_PUBLIC_SUPABASE_URL = undefined;
    mockEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getSupabaseAnonClient", () => {
    it("should create anon client with correct URL and key", async () => {
      mockCreateClient.mockReturnValue({} as any);
      vi.resetModules();
      const { getSupabaseAnonClient } = await import("./client");
      const client = getSupabaseAnonClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key",
        expect.objectContaining({
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }),
      );
      expect(client).toBeDefined();
    });

    it("should use NEXT_PUBLIC_SUPABASE_URL when available", async () => {
      mockEnv.NEXT_PUBLIC_SUPABASE_URL = "https://public.supabase.co";
      mockEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
      mockCreateClient.mockReturnValue({} as any);
      vi.resetModules();
      const { getSupabaseAnonClient } = await import("./client");
      getSupabaseAnonClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        "https://public.supabase.co",
        "public-anon-key",
        expect.any(Object),
      );
    });

    it("should throw when env vars are missing", async () => {
      mockEnv.SUPABASE_URL = "";
      mockEnv.SUPABASE_ANON_KEY = "";
      vi.resetModules();
      const { getSupabaseAnonClient } = await import("./client");

      expect(() => getSupabaseAnonClient()).toThrow(
        /\[Database\] anon Supabase client is not configured/,
      );
    });

    it("should return cached client on subsequent calls", async () => {
      mockCreateClient.mockReturnValue({ client: "anon" } as any);
      vi.resetModules();
      mockCreateClient.mockClear();
      mockCreateClient.mockReturnValue({ client: "anon" } as any);
      const { getSupabaseAnonClient } = await import("./client");
      const client1 = getSupabaseAnonClient();
      const client2 = getSupabaseAnonClient();

      expect(client1).toBe(client2);
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("getSupabaseServiceClient", () => {
    it("should create service client with service role key", async () => {
      mockCreateClient.mockReturnValue({} as any);
      vi.resetModules();
      const { getSupabaseServiceClient } = await import("./client");
      const client = getSupabaseServiceClient();

      expect(mockCreateClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-service-role-key",
        expect.objectContaining({
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }),
      );
      expect(client).toBeDefined();
    });

    it("should throw when service role key is missing", async () => {
      mockEnv.SUPABASE_URL = "";
      mockEnv.SUPABASE_SERVICE_ROLE_KEY = "";
      vi.resetModules();
      const { getSupabaseServiceClient } = await import("./client");

      expect(() => getSupabaseServiceClient()).toThrow(
        /\[Database\] service Supabase client is not configured/,
      );
    });

    it("should return cached client on subsequent calls", async () => {
      mockCreateClient.mockReturnValue({ client: "service" } as any);
      vi.resetModules();
      mockCreateClient.mockClear();
      mockCreateClient.mockReturnValue({ client: "service" } as any);
      const { getSupabaseServiceClient } = await import("./client");
      const client1 = getSupabaseServiceClient();
      const client2 = getSupabaseServiceClient();

      expect(client1).toBe(client2);
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    it("should create separate instances for anon and service clients", async () => {
      mockCreateClient
        .mockReturnValueOnce({ type: "anon" } as any)
        .mockReturnValueOnce({ type: "service" } as any);
      vi.resetModules();
      const { getSupabaseAnonClient, getSupabaseServiceClient } = await import("./client");
      const anonClient = getSupabaseAnonClient();
      const serviceClient = getSupabaseServiceClient();

      expect(anonClient).not.toBe(serviceClient);
      expect(mockCreateClient).toHaveBeenCalledTimes(2);
    });
  });
});
