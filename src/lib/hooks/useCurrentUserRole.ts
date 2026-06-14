"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

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

/** Set of profile roles that grant company-wide admin powers. */
const COMPANY_ADMIN_ROLES = new Set(["CEO", "COO", "admin"]);

/**
 * isCompanyAdminRole — predicate. True when the given role gives the
 * holder admin powers across the entire company (every topic, every
 * task, every surface). Centralized so the COO/CEO/admin set stays
 * consistent — these are the same roles checked by
 * /api/admin/team-check, /api/feedback/[id], and sidebar gating.
 */
export function isCompanyAdminRole(role: string | null | undefined): boolean {
  return role != null && COMPANY_ADMIN_ROLES.has(role);
}
