import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-call access grants (0336; Gong ledger F3.8; founder picker "Admin grants, logged"). A grant is active while it has
 * no revocation. Every read is pinned to the company. These are the ONLY answer to "may this person open this call
 * through a grant" — the shared-call route and the grants panel both ask here (§2.2).
 */
export type Grant = { id: string; sessionId: string; granteeId: string; grantedBy: string; reason: string; createdAt: string; active: boolean };

export async function grantsForCall(admin: SupabaseClient, companyId: string, sessionId: string): Promise<Grant[]> {
  const { data: rows, error } = await admin
    .from("call_access_grants")
    .select("id, session_id, grantee_id, granted_by, reason, created_at")
    .eq("company_id", companyId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`grants read failed: ${error.message}`);
  const list = (rows ?? []) as Array<{ id: string; session_id: string; grantee_id: string; granted_by: string; reason: string; created_at: string }>;
  if (!list.length) return [];
  const { data: revs, error: rErr } = await admin
    .from("call_access_revocations")
    .select("grant_id")
    .eq("company_id", companyId)
    .in("grant_id", list.map((g) => g.id));
  if (rErr) throw new Error(`revocations read failed: ${rErr.message}`);
  const revoked = new Set(((revs ?? []) as Array<{ grant_id: string }>).map((r) => String(r.grant_id)));
  return list.map((g) => ({
    id: String(g.id),
    sessionId: String(g.session_id),
    granteeId: String(g.grantee_id),
    grantedBy: String(g.granted_by),
    reason: g.reason,
    createdAt: g.created_at,
    active: !revoked.has(String(g.id)),
  }));
}

/** The viewer's active grant on this call, or null. Throws on a failed read (never "no grant" on an error). */
export async function activeGrant(admin: SupabaseClient, companyId: string, sessionId: string, viewerId: string): Promise<Grant | null> {
  return (await grantsForCall(admin, companyId, sessionId)).find((g) => g.active && g.granteeId === viewerId) ?? null;
}
