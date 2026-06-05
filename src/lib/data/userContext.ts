"use client";

import { createClient, supabaseEnabled } from "@/lib/supabase/client";

/**
 * loadUserContext — session-scoped cache for the current user's identity.
 *
 * Why this exists
 * ───────────────
 * Every live chat write (createTopic / postMessage / togglePin / closeTopic /
 * reviewDurability) used to perform two synchronous "who am I?" round trips
 * BEFORE the actual mutation:
 *
 *   1. `await supabase.auth.getUser()` — local in steady state, but still a
 *      promise to resolve on every call.
 *   2. `await supabase.from('profiles').select('company_id').eq('id', uid)` —
 *      a real network round trip to PostgREST.
 *
 * The user's `company_id` does not change within a session. The §1.7 audit's
 * R1 finding flagged this. This module memoizes a single Promise so:
 *
 *   - First call after sign-in pays the cost (~1 round trip — auth.getUser
 *     is usually local; the profiles query is the actual hop).
 *   - Every subsequent call returns the cached promise — zero round trips.
 *   - On sign-in / sign-out / user-update, the cache is invalidated so the
 *     next call refetches against the new identity.
 *
 * Concurrent first-callers
 * ────────────────────────
 * If two writes fire before the first promise resolves, both `await` the
 * same in-flight promise — no double-fetch. This is the deduplication
 * benefit of caching the Promise rather than its resolved value.
 *
 * Discipline
 * ──────────
 * - This module is client-only (use the `server-only` auth-helpers path on
 *   the server). Server components run per-request and have their own
 *   cookie-scoped supabase client; they don't benefit from a module cache.
 * - The cache is cleared on ANY auth state change, not just sign-out.
 *   Sign-in of a different user, password change, or session refresh all
 *   warrant a fresh identity read.
 */

export type UserContext = {
  userId: string;
  companyId: string;
  fullName: string | null;
  email: string | null;
};

let cachedPromise: Promise<UserContext> | null = null;
let listenerInstalled = false;

function installListenerOnce() {
  if (listenerInstalled) return;
  listenerInstalled = true;
  const supabase = createClient();
  supabase.auth.onAuthStateChange((event) => {
    // Every auth-state transition invalidates the cache. The next caller
    // will refetch against the new (or absent) session. We do NOT eagerly
    // refetch here — there may be no consumer right now, and a refetch
    // without a consumer is wasted work.
    if (
      event === "SIGNED_OUT" ||
      event === "SIGNED_IN" ||
      event === "USER_UPDATED" ||
      event === "TOKEN_REFRESHED"
    ) {
      cachedPromise = null;
    }
  });
}

export async function loadUserContext(): Promise<UserContext> {
  if (!supabaseEnabled) {
    throw new Error(
      "loadUserContext is live-mode only. Callers should branch on supabaseEnabled before invoking."
    );
  }
  installListenerOnce();
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Clear so a subsequent call after login can re-attempt cleanly.
      cachedPromise = null;
      throw new Error("Not signed in.");
    }
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("company_id, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      cachedPromise = null;
      throw new Error(error.message);
    }
    if (!profile?.company_id) {
      cachedPromise = null;
      throw new Error(
        "Your profile has no company. Join or create one in onboarding before posting."
      );
    }
    return {
      userId: user.id,
      companyId: profile.company_id,
      fullName: profile.full_name ?? null,
      email: user.email ?? null,
    };
  })();
  return cachedPromise;
}

/** Manually clear the cache. Exported for tests + explicit logout flows. */
export function clearUserContext() {
  cachedPromise = null;
}
