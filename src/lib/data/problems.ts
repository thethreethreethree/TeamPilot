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

export type ProblemsMode = "live-data" | "live-empty" | "demo-unavailable";

export async function fetchProblems(): Promise<{
  problems: ProblemRecord[];
  mode: ProblemsMode;
}> {
  if (!supabaseEnabled) {
    return { problems: [], mode: "demo-unavailable" };
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
