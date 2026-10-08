import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@thinkabell/config";
import type { Database } from "./types";

let _anonClient: SupabaseClient<Database> | null = null;
let _anonCreatedAt = 0;
let _serviceClient: SupabaseClient<Database> | null = null;
let _serviceCreatedAt = 0;

const CLIENT_TTL_MS = 5 * 60 * 1000;

function shouldRefresh(createdAt: number): boolean {
  return Date.now() - createdAt > CLIENT_TTL_MS;
}

/**
 * Fail-closed credential guard.
 *
 * Throws a descriptive error instead of silently constructing a client
 * pointed at an unconfigured (placeholder) project, which would mask
 * misconfiguration behind confusing network errors.
 */
function requireCredentials(
  url: string | undefined,
  key: string | undefined,
  clientType: "anon" | "service",
): void {
  if (!url || !key) {
    const keyVar =
      clientType === "service"
        ? "SUPABASE_SERVICE_ROLE_KEY"
        : "SUPABASE_ANON_KEY";
    throw new Error(
      `[Database] ${clientType} Supabase client is not configured. ` +
        `Set the SUPABASE_URL and ${keyVar} environment variables.`,
    );
  }
}

function createAnonClient(): SupabaseClient<Database> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  requireCredentials(url, key, "anon");

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createServiceClient(): SupabaseClient<Database> {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  requireCredentials(url, key, "service");

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAnonClient(): SupabaseClient<Database> {
  if (!_anonClient || shouldRefresh(_anonCreatedAt)) {
    _anonClient = createAnonClient();
    _anonCreatedAt = Date.now();
  }

  return _anonClient;
}

export function getSupabaseServiceClient(): SupabaseClient<Database> {
  if (!_serviceClient || shouldRefresh(_serviceCreatedAt)) {
    _serviceClient = createServiceClient();
    _serviceCreatedAt = Date.now();
  }

  return _serviceClient;
}