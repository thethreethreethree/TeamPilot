/**
 * ELOSALES Standard revision — authz for a MANAGER reading a named rep's skill profile.
 *
 * This is the gate on the one place the revision deliberately crosses the original self-only §A18
 * boundary (skills were rep-private). A18: "the label is the structural defense" — but the ACCESS gate
 * is the first defense. Extracted pure + tested so a future weakening (dropping the manager check or the
 * same-company check) fails CI, not just review. The route calls this; the rep's own self-view never
 * hits it (self reads need no permission — A10).
 */

import { isAdminRole } from "@/lib/roles";

export type SkillViewer = {
  role: string | null | undefined;
  sales_coach_role: string | null | undefined;
  company_id: string | null | undefined;
};

/** "Manager" for the sales coach = a Sales-Coach admin OR a company leader (CEO/COO/admin). */
export function isSalesCoachManager(caller: SkillViewer): boolean {
  return (
    caller.sales_coach_role === "admin" || isAdminRole(caller.role)
  );
}

/**
 * "Member" = who may ENTER the Sales Coach area (the layout access gate). A Sales-Coach
 * participant of ANY role (`admin` OR `staff` — a staff rep coaches in their own area) OR a
 * company leader (CEO/COO/admin, the bootstrap). Strictly WIDER than `isSalesCoachManager`:
 * every manager is a member, but a `staff` rep is a member and NOT a manager — conflating the
 * two would lock staff reps out of their own coaching area.
 *
 * Extracted pure + tested for the same reason as the manager gate above (this file's doctrine:
 * the access gate is the first defense; a future weakening must fail CI, not just review). The
 * `/dashboard/sales-coach` layout calls this instead of inlining the predicate — the sibling
 * `/dashboard/care` gate already routes through a shared tested predicate (`deriveCareAccess`).
 */
export function isSalesCoachMember(caller: SkillViewer): boolean {
  return (
    !!caller.sales_coach_role || isAdminRole(caller.role)
  );
}

/**
 * Can `caller` read `target`'s skill profile? Two conditions, both required:
 *  1. caller is a manager (else `not-manager`), and
 *  2. target is in the SAME company as caller (else `not-in-team` — the tenant boundary).
 * A missing target (e.g. RLS returned null for a cross-company id) is `not-in-team`.
 */
export function canManagerViewRepSkills(
  caller: SkillViewer,
  target: { company_id: string | null | undefined } | null | undefined
): { ok: true } | { ok: false; reason: "not-manager" | "not-in-team" } {
  if (!isSalesCoachManager(caller)) return { ok: false, reason: "not-manager" };
  if (!target || !caller.company_id || target.company_id !== caller.company_id) {
    return { ok: false, reason: "not-in-team" };
  }
  return { ok: true };
}
