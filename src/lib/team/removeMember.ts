import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROLES, isAdminRole } from "@/lib/roles";

/**
 * Take a person off the team — THE one place the rules live (2026-11-26; moved out of DELETE /api/team so the team CSV
 * import uses the same checks, ledger F2.8). The caller has already checked the actor is a company admin.
 *   · never yourself (leaving a company is a different flow);
 *   · never the company's last ACTIVE admin (an unrecoverable lock-out — the bulk path makes this reachable);
 *   · company-pinned, and a write that touched no row is reported, never claimed (§3.4 strictUpdate).
 * A soft removal (status 'removed', removed_at), as before: their calls and history stay. Service-role client required
 * (another person's profile row; the profiles update policy is self-only).
 */
export type RemoveResult = { ok: true } | { ok: false; status: 400 | 404 | 409 | 500; error: string };

export async function removeMember(sb: SupabaseClient, companyId: string, actorId: string, memberId: string): Promise<RemoveResult> {
  if (memberId === actorId) return { ok: false, status: 400, error: "You can't remove yourself from the company here." };
  const { data: target, error: tErr } = await sb.from("profiles").select("id, role, status").eq("company_id", companyId).eq("id", memberId).maybeSingle();
  if (tErr) {
    console.error(`[removeMember] read failed member=${memberId}: ${tErr.message}`);
    return { ok: false, status: 500, error: "Couldn't remove the member." };
  }
  if (!target || target.status !== "active") return { ok: false, status: 404, error: "That member isn't in your company, or was already removed." };
  if (isAdminRole(target.role as string | null)) {
    const { count, error: cErr } = await sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "active")
      .in("role", [...ADMIN_ROLES]);
    if (cErr) {
      console.error(`[removeMember] admin count failed company=${companyId}: ${cErr.message}`);
      return { ok: false, status: 500, error: "Couldn't remove the member." };
    }
    if ((count ?? 0) <= 1) return { ok: false, status: 409, error: "This is your company's only admin — make someone else an admin first." };
  }
  const { data: removed, error } = await sb
    .from("profiles")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .select("id");
  if (error) {
    console.error(`[removeMember] update failed member=${memberId}: ${error.message}`);
    return { ok: false, status: 500, error: "Couldn't remove the member." };
  }
  if (!removed || removed.length === 0) return { ok: false, status: 404, error: "That member isn't in your company, or was already removed." };
  return { ok: true };
}
