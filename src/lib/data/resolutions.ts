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

export type ResolutionsMode = "live-data" | "live-empty" | "demo-fixtures";

const demoFixtures: ResolutionRecord[] = [
  {
    id: "demo-r1",
    problemId: "demo-p-old",
    problemTitle: "Approvals stalling deployment cadence",
    actionTaken:
      "Assigned a single owner for cross-team approvals and added a 24-hour SLA with explicit escalation path.",
    reasoning:
      "Five signals across three weeks pointed at unowned approvals as the bottleneck. Putting a single owner with a clock on it removes the diffusion of responsibility that was producing the delay.",
    expectedOutcome:
      "Approval cycle drops from ~3 days to <1; deploy cadence returns to weekly.",
    observedOutcome:
      "Cycle dropped to 18 hours over the following 4 weeks; one deploy slipped due to an unrelated holiday.",
    durability: "held",
    reviewedAt: "2025-05-01T10:00:00Z",
    decidedAt: "2025-04-01T10:00:00Z",
  },
  {
    id: "demo-r2",
    problemId: "demo-p-old2",
    problemTitle: "Standup overrunning by 20+ minutes",
    actionTaken:
      "Time-box each update to 90 seconds; off-flow items moved to a dedicated 'parking lot' doc reviewed once per week.",
    reasoning:
      "Standups were absorbing tactical discussions that belonged elsewhere. The time-box plus parking lot puts those discussions where they have time to be useful without consuming everyone's attention.",
    expectedOutcome: "Standup back to 15 minutes; weekly meeting time recovered.",
    observedOutcome: null,
    durability: null,
    reviewedAt: null,
    decidedAt: "2025-05-05T10:00:00Z",
  },
];

export async function fetchResolutions(): Promise<{
  resolutions: ResolutionRecord[];
  mode: ResolutionsMode;
}> {
  if (!supabaseEnabled) {
    return { resolutions: demoFixtures, mode: "demo-fixtures" };
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
