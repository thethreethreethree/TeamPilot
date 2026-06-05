import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with service-role privileges.
 *
 * This bypasses RLS and can read `auth.users`. It MUST only be used
 * inside route handlers / server actions / scripts, never imported into
 * client bundles. Next.js will refuse to build if a "use client" file
 * pulls this in because process.env.SUPABASE_SERVICE_ROLE_KEY is not
 * exposed on the client.
 *
 * Use sparingly. Most reads should go through the user-scoped server
 * client (`@/lib/supabase/server`) which enforces RLS. Reach for this
 * only when you need to inspect cross-tenant state (e.g. "does this
 * email already exist in auth.users at all?") that RLS will not let
 * a normal client see.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing — service-role client unavailable."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Returns the auth.users row whose email matches (case-insensitive),
 * or null if no such user exists. Uses the admin /auth/v1/admin/users
 * endpoint which is the only supported way to query by email server-
 * side (the regular client API only returns the current session user).
 */
export async function findAuthUserByEmail(email: string): Promise<{
  id: string;
  email: string;
} | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    users?: Array<{ id: string; email?: string | null }>;
  };
  const u = data.users?.[0];
  if (!u || !u.email) return null;
  return { id: u.id, email: u.email };
}
