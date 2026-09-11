import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@thinkabell/config";
import type { Database } from "./types";

let _anonClient: SupabaseClient<Database> | null = null;
let _serviceClient: SupabaseClient<Database> | null = null;

const DEFAULT_SUPABASE_URL = "https://placeholder-project.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "placeholder-anon-key";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "placeholder-service-role-key";

/**
 * Returns a typed Supabase client with anonymous public permissions.
 * Safe for Next.js browser components and public server components.
 */
export function getSupabaseAnonClient(): SupabaseClient<Database> {
  if (_anonClient) return _anonClient;

  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  _anonClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _anonClient;
}

/**
 * Returns a privileged Supabase client using the Service Role secret key.
 * Used exclusively by background tasks (Trigger.dev) and protected API routes.
 */
export function getSupabaseServiceClient(): SupabaseClient<Database> {
  if (_serviceClient) return _serviceClient;

  const url = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;

  _serviceClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _serviceClient;
}

// Convenience export matching the codebase pattern
export const supabase = getSupabaseAnonClient();
