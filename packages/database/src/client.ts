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
 * Fail-closed credential guard. Returns the validated pair, or throws with a
 * descriptive error naming the variables to set — better than silently
 * constructing a client pointed at an unconfigured (placeholder) project,
 * which would mask misconfiguration behind confusing network errors.
 */
function requireCredentials(
  url: string | undefined,
  key: string | undefined,
  clientType: "anon" | "service",
): { url: string; key: string } {
  if (!url || !key) {
    const keyVar = clientType === "service" ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY";
    throw new Error(
      `[Database] ${clientType} Supabase client is not configured. ` +
        `Set the SUPABASE_URL and ${keyVar} environment variables.`,
    );
  }
  return { url, key };
}

/**
 * The Supabase project ref, for logging. The host is already validated as a
 * real project host by the env schema, so a non-empty label here means the
 * project was named correctly. The key is never logged — only its presence.
 */
function projectRef(url: string): string {
  const match = /^https?:\/\/([a-z0-9-]+)\.supabase\.(co|in|red)/i.exec(url);
  if (match) return match[1] ?? "";
  // A custom domain (or anything else): show the host only, never a path.
  return url.replace(/^https?:\/\//, "").split("/")[0] ?? "";
}

/** Log a client once per process: the first construction, later ones are silent. */
const logged = new Set<"anon" | "service">();

function logConnection(clientType: "anon" | "service", url: string, key: string): void {
  if (logged.has(clientType)) return;
  logged.add(clientType);
  const keySuffix = key.length > 8 ? `…${key.slice(-4)}` : "(set)";
  console.log(
    `[Database] Supabase ${clientType} client connected to project "${projectRef(url)}" ` +
      `(key ${keySuffix})`,
  );
}

/**
 * The Supabase project URL for this client.
 *
 * Both spellings are accepted because they are used by different flows:
 * `SUPABASE_URL` is what Supabase's server / connection-string flow and the
 * legacy setup use, while `NEXT_PUBLIC_SUPABASE_URL` is what its Next.js App
 * Router flow prescribes. They are the same value, so either one populates it.
 *
 * `prefer` picks the server-side name first, so a deployment that sets both
 * (which is the recommended setup) behaves identically whichever spelling is
 * consulted.
 */
function resolveSupabaseUrl(prefer: "server" | "public"): string | undefined {
  return prefer === "public"
    ? env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
    : env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
}

function createAnonClient(): SupabaseClient<Database> {
  const { url, key } = requireCredentials(
    resolveSupabaseUrl("public"),
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
    "anon",
  );
  logConnection("anon", url, key);

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createServiceClient(): SupabaseClient<Database> {
  const { url, key } = requireCredentials(
    resolveSupabaseUrl("server"),
    env.SUPABASE_SERVICE_ROLE_KEY,
    "service",
  );
  logConnection("service", url, key);

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
