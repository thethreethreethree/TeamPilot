"use client";

import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import type { CoachCitation } from "./heuristics";

/**
 * Read past `coach.pattern_observed` events for the CURRENT user
 * within the given subject (chat thread / task / feedback session
 * / smoke test draft session), bucketed per heuristic.
 *
 * Returns counts the CoachPanel mirror logic combines with the
 * current draft's hit. The user is the actor — we deliberately
 * only show YOUR pattern back to YOU. Not the team's pattern, not
 * the thread's pattern. Each person sees their own mirror.
 *
 * This is constitutional honesty (A11 + A10): the mirror is about
 * the user's own behavior, and the data they're seeing is the same
 * data the System used to decide whether to surface the chip.
 */
export async function fetchPatternCounts(args: {
  subject: string;
}): Promise<Partial<Record<CoachCitation["id"], number>>> {
  const empty: Partial<Record<CoachCitation["id"], number>> = {};
  if (!supabaseEnabled) return empty;
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return empty;
    const { data } = await supabase
      .from("events")
      .select("payload")
      .eq("kind", "coach.pattern_observed")
      .eq("subject", args.subject)
      .eq("actor", auth.user.id);
    if (!data) return empty;
    const counts: Partial<Record<CoachCitation["id"], number>> = {};
    for (const row of data) {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const id = typeof payload.heuristic_id === "string"
        ? (payload.heuristic_id as CoachCitation["id"])
        : null;
      if (!id) continue;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  } catch (err) {
    console.error("[coach] fetchPatternCounts failed:", err);
    return empty;
  }
}
