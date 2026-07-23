import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared C.A.R.E agent auth gate — single source of truth for
 * the "is this caller a C.A.R.E agent?" check used by every
 * /api/care/agent/* route.
 *
 * Why this exists per AMD-006 §1.5.1 layer 1 (structure
 * efficiency)
 * ────────────────────────────────────────────────────────
 * Before extraction, 22+ routes each implemented the same
 * ~10-line gate inline: fetch auth → select profile → check the
 * 4-way (is_support_agent OR role in CEO/COO/admin) condition.
 * Maintenance burden was real — when the agent-role matrix
 * changes (e.g., adding a "support_lead" role, or moving from
 * boolean is_support_agent to a status field), the edit lands
 * in 22 places. Easy to miss one, with security consequences.
 *
 * Single helper resolves it once. Adds isAdmin and companyId to
 * the success return so callers can do further per-role gating
 * without re-querying the profile.
 *
 * Success shape:
 *   { ok: true, sb, agentId, isAdmin, isAgent, companyId }
 *
 * Failure shape:
 *   { ok: false, error: string, status: 401 | 403 }
 *
 * Discriminated union via the `ok` field so TypeScript narrows
 * cleanly inside the success branch.
 */
export type CareAgentAuthResult =
  | {
      ok: true;
      sb: SupabaseClient;
      agentId: string;
      isAdmin: boolean;
      isAgent: boolean;
      companyId: string | null;
    }
  | {
      ok: false;
      error: string;
      status: 401 | 403;
    };

/**
 * Pure derivation of C.A.R.E access from a profile's role + support-agent flag —
 * the single-source-of-truth matrix this module exists to resolve once. Exported
 * so the security gate is a tested unit: isAdmin = a leadership role (CEO/COO/
 * admin); isAgent = a designated support agent OR an admin. A non-agent is denied.
 */
export function deriveCareAccess(args: {
  role: string | null;
  isSupportAgent: boolean | null | undefined;
  isRemoved?: boolean | null;
}): { isAdmin: boolean; isAgent: boolean } {
  // A member REMOVED from the company retains NO C.A.R.E access — neither agent nor
  // admin — regardless of role or the support-agent flag. Removal (team route) sets
  // profiles.status='removed' but does NOT clear is_support_agent / role, so THIS
  // gate is what actually revokes access. Without it a removed person would keep
  // handling live customer conversations (found auditing the 2026-07-07 removal fix).
  if (args.isRemoved) return { isAdmin: false, isAgent: false };
  const isAdmin =
    args.role === "CEO" || args.role === "COO" || args.role === "admin";
  const isAgent = !!args.isSupportAgent || isAdmin;
  return { isAdmin, isAgent };
}

export async function requireCareAgent(): Promise<CareAgentAuthResult> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "Not authenticated.", status: 401 };
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role, company_id, status")
    .eq("id", auth.user.id)
    .maybeSingle();
  const { isAdmin, isAgent } = deriveCareAccess({
    role: (profile?.role as string | null) ?? null,
    isSupportAgent: profile?.is_support_agent as boolean | null | undefined,
    // INVARIANT DEPENDENCY (2026-07-23 audit): this denylist ('removed' → block) is safe ONLY because
    // profiles.status is CHECK-constrained to exactly ('active','removed') in migration 0008. If a status is
    // ever added (e.g. 'suspended'), this AND the extension gate (extensionAuth.ts) both silently FAIL OPEN.
    // Then flip both to an allowlist (status === 'active'). Kept as a denylist here to match the extension gate.
    isRemoved: (profile?.status as string | null) === "removed",
  });
  if (!isAgent) {
    return { ok: false, error: "Care is agent-only.", status: 403 };
  }
  return {
    ok: true,
    sb,
    agentId: auth.user.id,
    isAdmin,
    isAgent,
    companyId: (profile?.company_id as string | null) ?? null,
  };
}
