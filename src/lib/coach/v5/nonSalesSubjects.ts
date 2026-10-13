import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The event subjects of the meetings and huddles in scope, so an aggregate read of sales reviews can leave them out.
 *
 * WHY (2026-10-13). Before the sales-only guard (d76b48a3) the sales engines wrote 2 reviews on non-sales sessions
 * (a meeting and a huddle). The per-call routes stopped serving them (55b9a655); the rep's training page and the
 * manager's coach assessment read reviews ACROSS calls by actor, so they still counted those 2 (R1-aggregate-reads).
 *
 * "Non-sales" is exactly the kinds resolveCoachingMode (and so isSalesCall, src/lib/coach/v5/salesOnly.ts) treats as
 * not a sales call: meeting and huddle. Everything else, including a missing or unknown kind, stays a sales call.
 *
 * Returns null when the read fails, so the caller degrades honestly instead of counting what it should have left out.
 */
export const NON_SALES_KINDS = ["meeting", "huddle"] as const;

export async function nonSalesSubjects(
  admin: SupabaseClient,
  scope: { companyId: string } | { agentId: string },
): Promise<string[] | null> {
  const base = admin.from("coaching_sessions").select("id").in("session_kind", [...NON_SALES_KINDS]);
  const { data, error } = await ("companyId" in scope ? base.eq("company_id", scope.companyId) : base.eq("agent_id", scope.agentId));
  if (error) return null;
  return (data ?? []).map((r) => `sales_session:${(r as { id: string }).id}`);
}

/**
 * The PostgREST list for `.not("subject", "in", list)`. Never empty: with no meetings to leave out it names a subject
 * no event can have, so the same filter applies in every case and no query is built two ways.
 */
export function subjectsNotIn(subjects: string[]): string {
  const list = subjects.length ? subjects : ["sales_session:none"];
  return `(${list.map((s) => `"${s}"`).join(",")})`;
}
