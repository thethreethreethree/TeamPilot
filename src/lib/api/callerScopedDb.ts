// callerScopedDb.ts — a Supabase client scoped to a MOBILE caller.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS TOUCHES AUTH ON WRITE PATHS. Read it before deploying; a green typecheck
// is not the review this wants.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY IT EXISTS, precisely. `resolveApiAuth` widens IDENTITY, which is all the
// KPI routes needed — they consume `getCurrentAuthContext()` and nothing else.
// Three session routes are shaped differently:
//
//   /[id]/outcome, /[id]/upload-recording, /[id]/upload-recording/sign
//
// each calls `getSession(id)` as its access check, and `getSession` reads
// through the COOKIE client. On a Bearer request there is no cookie, RLS returns
// nothing, the session reads as missing, and the route 404s. The caller
// authenticates and is then invisible to itself.
//
// The plan document (06-BACKEND-BEARER-SHIM.md) says these are the same one-line
// change as the KPI routes. They are not, and following it literally produces
// routes that authenticate and then fail at the first query.
//
// NOTHING IN THIS REPO HAD DONE THIS BEFORE. Every extension route that accepts
// a Bearer token touches zero tables — they are pure AI endpoints. So there was
// no existing pattern to copy, which is why this file is new.
//
// WHY THE ANON KEY AND NOT THE SERVICE ROLE. The client below carries the
// caller's own access token, so PostgREST reads their JWT, `auth.uid()` resolves
// to them, and EVERY EXISTING RLS POLICY APPLIES UNCHANGED — the same rules the
// website runs under, not a second set. The service-role client would bypass RLS
// entirely and turn each of these routes into a place where one missing
// ownership check becomes a cross-tenant read. It fails CLOSED: a bad or expired
// token means queries return nothing, never someone else's rows.
//
// The cookie path is untouched. Web callers never reach this.

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/** The Bearer token on a request, or "" when there is not one. */
export function bearerToken(req: Request): string {
  // Read defensively. A route helper should assume no more of the request than
  // it actually needs, and callers legitimately hand these routes minimal
  // request-shaped objects — the existing sign-route tests pass `{ json }` and
  // nothing else. Demanding a full Request there would fail eight tests that
  // describe real behaviour, which is the helper being wrong, not the tests.
  const header = req?.headers?.get?.("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

/**
 * A Supabase client that acts as the caller.
 *
 * Returns null when there is no Bearer token or the environment is not
 * configured — the caller then falls back to the cookie client exactly as
 * before, so a web request behaves identically.
 *
 * The client is not session-persisting: it exists for one request.
 */
export function callerScopedDb(req: Request): SupabaseClient | null {
  const token = bearerToken(req);
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createSupabaseClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
