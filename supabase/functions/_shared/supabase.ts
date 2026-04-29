// @ts-expect-error Node TypeScript cannot resolve Deno npm: specifiers in editor mode.
import { createClient } from "npm:@supabase/supabase-js@2";

function requireEnv(name: string): string {
  const denoEnv =
    "Deno" in globalThis
      ? (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
      : undefined;
  const value = denoEnv?.get?.(name);

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function createServiceRoleClient() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createUserClient(authHeader: string | null) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");

  const headers: Record<string, string> = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
