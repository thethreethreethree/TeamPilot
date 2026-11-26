import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROLES, isAdminRole, isAssignableOrgRole } from "@/lib/roles";

/**
 * Set a team member's org role — THE one place the rules live (2026-11-25; moved out of /api/team/set-role so the team
 * CSV import uses the same checks, ledger F2.8). The caller has already checked the actor is a company admin. Which
 * roles may be set is checked HERE too (isAssignableOrgRole), so no caller can set a role the Team page refuses
 * (review 2026-11-25: the CSV could set "Lead"). Company-pinned: the target must be in `companyId`, and the write is scoped by company_id. Refuses a
 * change that would remove the company's LAST admin (an unrecoverable lock-out). Service-role client required
 * (`profiles.role` is a guarded privileged column, 0090/0091).
 */
export type SetRoleResult = { ok: true; from: string | null } | { ok: false; status: 400 | 404 | 409 | 500; error: string };

export async function setMemberRole(sb: SupabaseClient, companyId: string, memberId: string, role: string): Promise<SetRoleResult> {
  if (!isAssignableOrgRole(role)) return { ok: false, status: 400, error: `"${role}" isn't a role you can set on the Team page.` };
  const { data: target } = await sb.from("profiles").select("id, role, company_id").eq("id", memberId).maybeSingle();
  if (!target || (target.company_id as string | null) !== companyId) {
    return { ok: false, status: 404, error: "Member not found in your company." };
  }
  const from = (target.role as string | null) ?? null;
  if (isAdminRole(from) && !isAdminRole(role)) {
    const { count } = await sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "active") // a removed admin can't sign in to fix things (2026-11-26)
      .in("role", [...ADMIN_ROLES]);
    if ((count ?? 0) <= 1) {
      return { ok: false, status: 409, error: "This is your company's only admin — promote someone to a C-Suite role first, then change this one." };
    }
  }
  const { error } = await sb.from("profiles").update({ role }).eq("id", memberId).eq("company_id", companyId);
  if (error) {
    console.error(`[setMemberRole] update failed member=${memberId}: ${error.message}`);
    return { ok: false, status: 500, error: "Couldn't update the role." };
  }
  return { ok: true, from };
}
