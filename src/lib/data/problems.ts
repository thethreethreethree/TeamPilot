import { createClient, supabaseEnabled } from "@/lib/supabase/client";

export type ProblemStatus =
  | "draft"
  | "surfaceable"
  | "surfaced"
  | "resolved"
  | "dismissed";

export type ProblemRecord = {
  id: string;
  kind: string;
  title: string;
  diagnosis: string | null;
  status: ProblemStatus;
  surfaced_at: string | null;
  resolved_at: string | null;
  created_at: string;
  signalCount: number;
};

export type ProblemsMode = "live-data" | "live-empty" | "demo-fixtures";

const demoFixtures: ProblemRecord[] = [
  {
    id: "demo-p1",
    kind: "operational_bottleneck",
    title: "Payment gateway integration is repeatedly blocked",
    diagnosis:
      "Across three weeks, the gateway task has been flagged Blocked twice and reassigned twice between finance and engineering. The signal pattern points at an unowned approvals dependency rather than a technical issue with the integration itself.",
    status: "surfaced",
    surfaced_at: "2025-05-12T09:00:00Z",
    resolved_at: null,
    created_at: "2025-05-10T09:00:00Z",
    signalCount: 5,
  },
  {
    id: "demo-p2",
    kind: "workload_imbalance",
    title: "Lead engineer carrying disproportionate workload",
    diagnosis:
      "Multiple distinct signals across two weeks (workload_high, overdue tasks, blocker recorded) point to one individual absorbing work that should have been redistributed.",
    status: "draft",
    surfaced_at: null,
    resolved_at: null,
    created_at: "2025-05-09T11:00:00Z",
    signalCount: 3,
  },
];

export async function fetchProblems(): Promise<{
  problems: ProblemRecord[];
  mode: ProblemsMode;
}> {
  if (!supabaseEnabled) {
    return { problems: demoFixtures, mode: "demo-fixtures" };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("problems")
    .select(
      "id, kind, title, diagnosis, status, surfaced_at, resolved_at, created_at, problem_signals(signal_id)"
    )
    .order("created_at", { ascending: false });

  if (error || !data) return { problems: [], mode: "live-empty" };

  const problems: ProblemRecord[] = data.map((row) => {
    const signals = row.problem_signals as Array<{ signal_id: string }> | null;
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      diagnosis: row.diagnosis,
      status: row.status as ProblemStatus,
      surfaced_at: row.surfaced_at,
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      signalCount: Array.isArray(signals) ? signals.length : 0,
    };
  });

  return {
    problems,
    mode: problems.length === 0 ? "live-empty" : "live-data",
  };
}
