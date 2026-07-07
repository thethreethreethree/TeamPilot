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
  const target = email.toLowerCase().trim();

  // WHY THIS IS NOT `?email=` + users[0]:
  // GoTrue's admin list-users endpoint does NOT reliably filter by the `?email=`
  // query param on this instance — it returns the first page of ALL users in
  // default order and ignores the param. The previous implementation took
  // `data.users[0]` WITHOUT verifying its email, so for EVERY lookup it returned
  // the same first-in-list user — producing the "wrong person is already a member
  // of this company" defect (a new invitee's email resolved to whoever sorts
  // first in auth.users). We must page through and match the `email` field
  // EXACTLY. Lesson on the record: feedback_admin_users_email_filter (2026-06-28)
  // — "verify the target by the actual email field; assert exactly one match
  // before acting." A false MATCH here is worse than a miss: it blocks a
  // legitimate invite and names an unrelated person (§3.4 — never assert a fact
  // that isn't true).
  const admin = createAdminClient();
  const PER_PAGE = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error || !data) return null;
    const match = data.users.find(
      (u) => (u.email ?? "").toLowerCase().trim() === target
    );
    if (match?.email) return { id: match.id, email: match.email };
    if (data.users.length < PER_PAGE) break; // last page reached, no match
  }
  return null;
}
