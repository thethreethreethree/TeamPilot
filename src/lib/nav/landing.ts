import type { SupabaseClient } from "@supabase/supabase-js";
import { CARE_ROOT, SALES_COACH_ROOT, lockFromPilotModule } from "@/lib/auth/moduleAccess";

/**
 * Post-auth landing per module — the SINGLE source of truth for where a module's
 * user belongs, shared by the redeem flow (server) and the login flow (via
 * /api/me/landing). Login previously hardcoded /dashboard while redeem mapped by
 * module; that divergence (A21 — one concept, two behaviours) was the "everyone
 * lands on main regardless of module" bug. One map, one behaviour.
 */
export const MODULE_LANDING: Record<string, string> = {
  elostate: "/dashboard",
  // The two module-home paths live once in moduleAccess.ts (the middleware guard's source); imported here so
  // this map and the guard can't drift (A21 — one concept, one encoding).
  care: CARE_ROOT,
  sales_coach: SALES_COACH_ROOT,
};

export function moduleLanding(module: string | null | undefined): string {
  return MODULE_LANDING[module ?? ""] ?? "/dashboard";
}

/**
 * Resolve where a signed-in user should land.
 *
 * PRIMARY signal (added 2026-08-01): `companies.access_module` — the unified module-lock column from
 * migration 0207, the SAME signal the middleware confines on. A locked care/sales_coach account lands
 * directly in its module. (The earlier note here — "there is NO unified module column" — predated 0207.)
 *
 * FALLBACK for a null access_module (a "complete"/elostate account, or a pre-0207 legacy account) — the
 * original module levers this codebase had before the column existed:
 *   - Sales Coach access → `profiles.sales_coach_role` is set (admin|staff)
 *   - C.A.R.E access     → the company has a `care_tenant_config` row
 * Founder rule (2026-07-28): exactly ONE module → that module's home; BOTH or NEITHER → the /dashboard
 * hub. NOTE this lever heuristic is unreliable post-0045 (care_tenant_config exists for every company) —
 * which is why access_module supersedes it above; it survives only as the no-regression path for the
 * accounts that have no access_module set.
 *
 * Read through the caller's RLS-bound client, so a user who cannot see a lever simply does not have that
 * module — fail-safe to the hub.
 */
export async function resolveUserLanding(
  sb: SupabaseClient,
  userId: string,
  companyId: string | null
): Promise<string> {
  // PRIMARY signal: the 0207 module-lock column — the SAME signal the middleware confines on, so the
  // login landing and the confinement can never disagree (A21 one-concept-one-encoding). A single-module
  // (locked) account lands DIRECTLY in its module in one hop instead of landing on /dashboard and getting
  // bounced there by the middleware. This also supersedes the stale lever-heuristic below for locked
  // accounts: migration 0045 auto-creates a care_tenant_config row for EVERY company, so `hasCare` is
  // ALWAYS true — a sales_coach user would otherwise hit the both-levers branch and land on the hub, never
  // their module (the exact "lands on main regardless of module" bug 0207's access_module column closes).
  // A null access_module (complete, or a pre-0207 legacy account) falls through to the original levers so
  // no existing account's landing regresses.
  if (companyId) {
    const { data: company } = await sb
      .from("companies")
      .select("access_module")
      .eq("id", companyId)
      .maybeSingle();
    const lock = lockFromPilotModule(company?.access_module ?? null);
    if (lock) return moduleLanding(lock);
  }

  const profileQ = sb
    .from("profiles")
    .select("sales_coach_role")
    .eq("id", userId)
    .maybeSingle();
  const careQ = companyId
    ? sb
        .from("care_tenant_config")
        .select("company_id")
        .eq("company_id", companyId)
        .maybeSingle()
    : null;

  const [{ data: profile }, careRes] = await Promise.all([
    profileQ,
    careQ ?? Promise.resolve({ data: null as { company_id: string } | null }),
  ]);

  const hasSalesCoach = !!profile?.sales_coach_role;
  const hasCare = !!careRes?.data;

  if (hasCare && !hasSalesCoach) return moduleLanding("care");
  if (hasSalesCoach && !hasCare) return moduleLanding("sales_coach");
  return "/dashboard"; // both, or neither → hub
}

/**
 * Client-side: ask the server where this authenticated user should land, falling
 * back to the hub on any failure so it never blocks a redirect. Used by every
 * post-auth entry (login, password recovery, invite accept) so they all land the
 * user in their module rather than the main hub — one helper, no divergence.
 */
export async function fetchLanding(fallback = "/dashboard"): Promise<string> {
  try {
    const res = await fetch("/api/me/landing");
    if (res.ok) {
      const j = (await res.json()) as { landing?: unknown };
      if (typeof j.landing === "string") return j.landing;
    }
  } catch {
    /* network hiccup → fall back to the hub */
  }
  return fallback;
}
