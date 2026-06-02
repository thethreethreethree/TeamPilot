"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

/**
 * Single source of truth for "what company is signed in right now."
 * Used by TopBar/Sidebar/any surface that displays the company name so the
 * UI never shows two different names on the same screen.
 *
 * Returns:
 *   - 'Demo Co' in demo mode (no Supabase configured)
 *   - The signed-in user's company name in live mode
 *   - '—' transiently while loading
 */
export function useCompanyName(): string {
  const [name, setName] = useState<string>(supabaseEnabled ? "—" : "Demo Co");

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("companies(name)")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      const company = profile?.companies as { name?: string } | null;
      if (company?.name) setName(company.name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return name;
}
