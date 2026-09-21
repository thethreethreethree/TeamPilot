import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";

/**
 * "Is this caller a Sales Coach manager?" — resolved in ONE place.
 *
 * `isSalesCoachManager` in skillAccess.ts is the authority, extracted and unit-tested for a stated
 * reason: *"a future weakening (dropping the manager check or the same-company check) fails CI,
 * not just review."* But `AuthContext` does not carry `sales_coach_role`, so every route that
 * wants the predicate has had to fetch the column itself and then decide — and deciding is the
 * part that must not be duplicated.
 *
 * It already had been. `/api/coach/gamification/calibration` carried a local `requireManager` that
 * re-derived the rule as `ctx.isAdmin || sales_coach_role === "admin"`. That agrees with the
 * authority TODAY and is exactly the §2.2 shape: the moment `isSalesCoachManager` gains a term —
 * a `manager` sales_coach_role, a `removed_at` check — the copy silently keeps letting people
 * through, with every test green. Duplicated conditions drift; that is the whole clause.
 *
 * So this helper does the fetching and hands the decision to the authority. Routes consume the
 * verdict and never re-express the rule.
 */

export type SalesCoachManager = { userId: string; companyId: string };

/**
 * Returns the caller when they are a Sales Coach manager, or null.
 *
 * Bearer-reachable: `resolveApiAuth` tries the web cookie session first and falls back to a Bearer
 * token, so a manager on a phone is not silently anonymous.
 */
export async function requireSalesCoachManager(req: Request): Promise<SalesCoachManager | null> {
  const ctx = await resolveApiAuth(req);
  if (!ctx) return null;

  // The service-role read is safe and necessary here: the caller's own profile row, one column,
  // for a decision about the caller. It is not a cross-tenant read.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("sales_coach_role")
    .eq("id", ctx.userId)
    .maybeSingle();

  // The verdict, from the authority. Note it is asked even when the profile read came back empty:
  // isSalesCoachManager still honours the company-leader half via ctx.role, and short-circuiting
  // on a null profile would silently lock out a CEO whose profile row failed to load.
  const allowed = isSalesCoachManager({
    role: ctx.role,
    sales_coach_role: profile?.sales_coach_role ?? null,
    company_id: ctx.companyId,
  });

  return allowed ? { userId: ctx.userId, companyId: ctx.companyId } : null;
}
