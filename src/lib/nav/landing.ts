import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Post-auth landing per module — the SINGLE source of truth for where a module's
 * user belongs, shared by the redeem flow (server) and the login flow (via
 * /api/me/landing). Login previously hardcoded /dashboard while redeem mapped by
 * module; that divergence (A21 — one concept, two behaviours) was the "everyone
 * lands on main regardless of module" bug. One map, one behaviour.
 */
export const MODULE_LANDING: Record<string, string> = {
  elostate: "/dashboard",
  care: "/dashboard/care",
  sales_coach: "/dashboard/sales-coach",
};

export function moduleLanding(module: string | null | undefined): string {
  return MODULE_LANDING[module ?? ""] ?? "/dashboard";
}

/**
 * Resolve where a signed-in user should land, from the module levers this codebase
 * actually has (there is NO unified module column — verified 2026-07-28):
 *   - Sales Coach access → `profiles.sales_coach_role` is set (admin|staff)
 *   - C.A.R.E access     → the company has a `care_tenant_config` row
 *
 * Founder rule (2026-07-28): exactly ONE module → that module's home; BOTH or
 * NEITHER → the /dashboard hub (which shows everything). "Neither" is a plain
 * ELOSTATE user, correctly the hub.
 *
 * Read through the caller's RLS-bound client, so a user who cannot see a lever
 * simply does not have that module — fail-safe to the hub.
 */
export async function resolveUserLanding(
  sb: SupabaseClient,
  userId: string,
  companyId: string | null
): Promise<string> {
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
