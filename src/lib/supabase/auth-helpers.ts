import "server-only";
import { createClient } from "./server";

/**
 * The company-admin (leadership) role set — the single source of truth for
 * "is this user a company admin?". Authored once (§A13) so a change to the set
 * (e.g. adding a role) happens in ONE place instead of the ~12 sites that
 * currently inline `role === 'CEO' || 'COO' || 'admin'`. New code should call
 * isAdminRole(); existing gates can migrate to it incrementally.
 */
export const ADMIN_ROLES = ["CEO", "COO", "admin"] as const;

/** True iff the role is a company-admin (leadership) role. Exact match — no
 *  accidental broadening (e.g. "Lead"/"administrator" are NOT admin). */
export function isAdminRole(role: string | null | undefined): boolean {
  return role != null && (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Server-side helper: resolve the current authenticated user's company id.
 * Returns null when in demo mode (Supabase not configured) or when the user
 * has not yet completed onboarding.
 */
export async function getCurrentCompanyId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    return profile?.company_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Server-side helper: resolve the current user's company AND whether they
 * hold a leadership role (CEO / COO / admin). Used by surfaces gated to
 * company admins — Brain unlock (§3.4 override), Coach readout (leadership-
 * only analytics), Settings-level admin actions.
 *
 * Returns null when:
 *   - not authenticated
 *   - no company on profile
 *
 * Per TT.md A21 audit (2026-06-18) — two CRITICAL findings (Brain unlock
 * + Coach readout) both lacked admin role checks. This helper exists so
 * every future admin-gated route uses the same matrix instead of inline
 * role checks that drift over time.
 */
export type AuthContext = {
  userId: string;
  companyId: string;
  role: string | null;
  isAdmin: boolean;
};

export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile?.company_id) return null;
    const role = (profile.role as string | null) ?? null;
    const isAdmin = isAdminRole(role);
    return {
      userId: auth.user.id,
      companyId: profile.company_id,
      role,
      isAdmin,
    };
  } catch {
    return null;
  }
}
