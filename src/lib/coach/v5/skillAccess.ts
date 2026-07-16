/**
 * ELOSALES Standard revision — authz for a MANAGER reading a named rep's skill profile.
 *
 * This is the gate on the one place the revision deliberately crosses the original self-only §A18
 * boundary (skills were rep-private). A18: "the label is the structural defense" — but the ACCESS gate
 * is the first defense. Extracted pure + tested so a future weakening (dropping the manager check or the
 * same-company check) fails CI, not just review. The route calls this; the rep's own self-view never
 * hits it (self reads need no permission — A10).
 */

export type SkillViewer = {
  role: string | null | undefined;
  sales_coach_role: string | null | undefined;
  company_id: string | null | undefined;
};

/** "Manager" for the sales coach = a Sales-Coach admin OR a company leader (CEO/COO/admin). */
export function isSalesCoachManager(caller: SkillViewer): boolean {
  return (
    caller.sales_coach_role === "admin" ||
    caller.role === "CEO" ||
    caller.role === "COO" ||
    caller.role === "admin"
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
