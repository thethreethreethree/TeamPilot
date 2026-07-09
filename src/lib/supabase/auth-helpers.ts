import "server-only";
import { createClient } from "./server";

// Role vocabulary now lives in the single client-safe source (src/lib/roles.ts,
// §A13). Imported for local use (getCurrentAuthContext below) AND re-exported so
// the ~20 existing server importers of auth-helpers keep working unchanged while
// the definition exists in exactly one place.
import { ADMIN_ROLES, isAdminRole } from "@/lib/roles";
export { ADMIN_ROLES, isAdminRole };

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
