"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { isAdminRole } from "@/lib/roles";

/**
 * useCurrentUserRole — returns the current user's company-level role
 * from the profiles table. Returns `null` while loading or when
 * unauthenticated.
 *
 * Values: 'CEO' | 'COO' | 'admin' | 'Lead' | 'Member' | null
 *
 * Why this exists: several surfaces (chat detail page, settings,
 * admin readouts) need to know whether the viewer is a company-level
 * admin. Without this, per-topic role checks ignore the fact that a
 * company CEO/COO/admin should have admin powers on every topic in
 * their company — the bug Darren flagged where John couldn't see the
 * admin chip row on Development LAB even though he created it.
 */
export function useCurrentUserRole(): string | null {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!cancelled) setRole(profile?.role ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return role;
}

/**
 * isCompanyAdminRole — predicate. True when the given role gives the holder admin
 * powers across the entire company (every topic, every task, every surface).
 *
 * Delegates to the CANONICAL isAdminRole / ADMIN_ROLES (@/lib/roles), which authors
 * the company-admin set once (A13). Previously this held its own duplicate
 * {CEO,COO,admin} Set — a second copy of a security gate that could drift from the
 * canonical one. Kept as a named alias since callers import it by this name.
 */
export function isCompanyAdminRole(role: string | null | undefined): boolean {
  return isAdminRole(role);
}

/**
 * useIsSalesCoachManager — client predicate for the Sales Coach MANAGER surfaces
 * (Team, Coach Assessment). Delegates to the SAME pure predicate the server gate
 * and routes use — isSalesCoachManager (src/lib/coach/v5/skillAccess.ts) — so the
 * nav's notion of "manager" can never drift from the actual access gate (A13:
 * author the vocabulary once).
 *
 * Returns `false` while loading / unauthenticated — the SAFE default for nav
 * gating (hide manager-only items until the viewer is confirmed a manager, so a
 * rep never sees a nav item that would bounce them; AMD-006 L3).
 */
export function useIsSalesCoachManager(): boolean {
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, sales_coach_role")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      // Reuse the canonical gate (company_id is unused by the manager check — it's role-only).
      setIsManager(
        isSalesCoachManager({
          role: (profile?.role as string | null) ?? null,
          sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
          company_id: null,
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isManager;
}
