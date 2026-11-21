import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Password sign-in for the login pages — through POST /api/auth/sign-in (RSS Phase 0 step 7), which records
 * the attempt and applies the lockout rule once D4 is decided, then sets the same session cookies the browser
 * client would have.
 *
 * THE FALLBACK IS THE POINT. Sign-in failed for every user on 2026-11-11. A new server hop must not become a
 * second way for that to happen, so when the route ITSELF cannot answer — network failure, or a 5xx that is
 * ours — this signs in directly with the browser client exactly as the pages did before. A real answer from
 * the route (wrong password 400, locked 429, rate-limited 429) is final and never retried around.
 *
 * Returns null on success, or the message to show — the same messages the pages showed before.
 */
export type SignInFetch = (input: string, init?: RequestInit) => Promise<Response>;

export async function signInViaServer(
  supabase: SupabaseClient,
  email: string,
  password: string,
  fetchImpl: SignInFetch = fetch
): Promise<string | null> {
  let res: Response | null = null;
  try {
    res = await fetchImpl("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "same-origin",
    });
  } catch {
    res = null; // the route is unreachable — fall back below
  }

  if (res && res.status < 500) {
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? "Sign-in failed.";
  }

  // Our route failed, not the credentials: the old direct path, so a fault here never locks everyone out.
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}
