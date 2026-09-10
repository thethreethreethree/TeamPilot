import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

/**
 * The caller's company, for a route that serves BOTH the web and the phone.
 *
 * `getCurrentCompanyId()` builds its OWN cookie client. A phone sends a Bearer token and no cookie, so it
 * resolves nobody, returns null, and the route answers 403 — an authenticated rep told they have no
 * company. It is the cookie-client class in its quietest form: the failure is indistinguishable from a
 * genuine permission problem, and it looks identical in a log.
 *
 * Four routes already carried the same six-line fallback inline, each with its own copy of the comment
 * explaining why. Two did not — `attribute-unlabelled` and `auto-recover` — and both were 403 for every
 * phone caller: the answer-whose-voice-this-is flow and the recover-my-dropped-call button, which are
 * exactly the two things a rep reaches for when a call did not come out right. Confirmed live against
 * production on 2026-09-10, not inferred: a real Bearer token for a real rep, on their own session,
 * answered `{"error":"No company context."}`.
 *
 * So the rule lives in one place now. A route that forgets the mobile half can no longer half-work,
 * because there is no longer a half to forget — which is the only kind of fix that survives the next
 * route somebody writes.
 *
 * The web path is unchanged and still tried first: same value, same rules, same source of truth.
 */
export async function callerCompanyId(
  db: SupabaseClient,
  userId: string
): Promise<string | undefined> {
  const fromCookie = await getCurrentCompanyId();
  if (fromCookie) return fromCookie;
  // The caller's own profile row, read through the caller's own client, so RLS still decides.
  const { data } = await db.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  return (data?.company_id as string | undefined) ?? undefined;
}
