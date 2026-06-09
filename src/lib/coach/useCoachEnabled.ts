"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";

/**
 * useCoachEnabled — reads `companies.coach_enabled` for the current
 * user's company. Surfaces (tasks, feedback, smoke test notes, etc.)
 * use this hook to decide whether to mount the CoachPanel.
 *
 * Chat topics have an additional per-topic override (`chat_topics.
 * coach_enabled`) that wins when set — the topic-level flag is
 * checked at the chat composer separately.
 *
 * Defaults to `false` until the company row loads (A3 — when in
 * doubt, OFF). Loading-state flag exposed so callers can avoid
 * flashing the Coach on for one frame before the actual flag
 * arrives.
 */
export function useCoachEnabled(): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!supabaseEnabled) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const supabase = createClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (!profile?.company_id) return;
        const { data: company } = await supabase
          .from("companies")
          .select("coach_enabled")
          .eq("id", profile.company_id)
          .maybeSingle();
        if (!cancelled && company) {
          setEnabled(Boolean(company.coach_enabled));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
}
