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

export async function requireCareAgent(): Promise<CareAgentAuthResult> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "Not authenticated.", status: 401 };
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string | null) ?? null;
  const isAdmin = role === "CEO" || role === "COO" || role === "admin";
  const isAgent = !!profile?.is_support_agent || isAdmin;
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
