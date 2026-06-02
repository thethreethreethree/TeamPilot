import { createClient, supabaseEnabled } from "@/lib/supabase/client";

export type ResolutionRecord = {
  id: string;
  problemId: string;
  problemTitle: string | null;
  actionTaken: string;
  reasoning: string;
  expectedOutcome: string | null;
  observedOutcome: string | null;
  durability: "held" | "reopened" | "partial" | "unknown" | null;
  reviewedAt: string | null;
  decidedAt: string;
};

export type ResolutionsMode = "live-data" | "live-empty" | "demo-unavailable";

export async function fetchResolutions(): Promise<{
  resolutions: ResolutionRecord[];
  mode: ResolutionsMode;
}> {
  if (!supabaseEnabled) {
    return { resolutions: [], mode: "demo-unavailable" };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resolutions")
    .select(
      "id, problem_id, action_taken, reasoning, expected_outcome, observed_outcome, durability, reviewed_at, decided_at, problems(title)"
    )
    .order("decided_at", { ascending: false });

  if (error || !data) return { resolutions: [], mode: "live-empty" };

  const resolutions: ResolutionRecord[] = data.map((row) => {
    const problem = row.problems as { title?: string } | null;
    return {
      id: row.id,
      problemId: row.problem_id,
      problemTitle: problem?.title ?? null,
      actionTaken: row.action_taken,
      reasoning: row.reasoning,
      expectedOutcome: row.expected_outcome,
      observedOutcome: row.observed_outcome,
      durability: row.durability,
      reviewedAt: row.reviewed_at,
      decidedAt: row.decided_at,
    };
  });

  return {
    resolutions,
    mode: resolutions.length === 0 ? "live-empty" : "live-data",
  };
}
