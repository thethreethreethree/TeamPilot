/**
 * Close the Loop (§1.6).
 *
 * "Every resolution — and its measured outcome — becomes a new asset that feeds
 *  step 1. The System gets smarter about this specific team/codebase over time."
 *
 * This module records the chosen resolution via the SQL `close_problem()` function
 * in migration 0005. The SQL function:
 *   1. Inserts the resolution row (immutable action/reasoning)
 *   2. Marks the problem as resolved
 *   3. Emits a `problem.resolved` event so the loop closes back into events
 *
 * Doing it in SQL (not in JS) means the close-the-loop semantics cannot be
 * partially executed — either all three steps happen or none do. The constitution's
 * loop integrity is enforced at the DB layer.
 */

import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import type { CandidateResolution } from "./types";

type CloseArgs = {
  problemId: string;
  chosen: CandidateResolution;
};

type CloseResult = {
  ok: boolean;
  resolutionId?: string;
  error?: string;
};

export async function closeProblemLoop(args: CloseArgs): Promise<CloseResult> {
  if (!supabaseEnabled) {
    return {
      ok: false,
      error: "Demo mode — close-the-loop requires a live Supabase project.",
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("close_problem", {
    p_problem_id: args.problemId,
    p_action_taken: args.chosen.action,
    p_reasoning: args.chosen.reasoning,
    p_expected_outcome: args.chosen.expectedOutcome,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, resolutionId: data as string };
}
