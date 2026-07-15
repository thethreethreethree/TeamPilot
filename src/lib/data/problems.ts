import { createClient, supabaseEnabled } from "@/lib/supabase/client";

export type ProblemStatus =
  | "draft"
  | "surfaceable"
  | "surfaced"
  | "resolved"
  | "dismissed";

/**
 * Statuses where a problem is still IN PLAY — the single source of truth for
 * "open problem". Per the §3.2 lifecycle (migration 0002): draft (pre-gate) →
 * surfaceable (gate passed, may be shown) → surfaced (shown, timestamped). All
 * three are open; only 'resolved' / 'dismissed' are closed.
 *
 * NB on 'surfaceable': the constitutional model defines it, but the live app
 * transitions problems draft → surfaced DIRECTLY (problems/page.tsx, diagnose)
 * and nothing auto-promotes to 'surfaceable' (the 0002 trigger only VALIDATES a
 * transition, it doesn't set the state), so 'surfaceable' is currently
 * unoccupied in practice. Including it here is defensive-correct, not a live-bug
 * fix — it means any future path that DOES produce 'surfaceable' (e.g. an
 * auto-promotion trigger) is counted as open everywhere at once. This was
 * hand-listed inline in the finance dimensions route; it now imports this so the
 * definition lives in one place. (The dashboard's draft+surfaced count is
 * correct-in-practice and left as-is; if 'surfaceable' ever gets used, switch it
 * to isProblemOpen too.)
 */
export const OPEN_PROBLEM_STATUSES: ProblemStatus[] = [
  "draft",
  "surfaceable",
  "surfaced",
];

/** True when a problem is still in play (not resolved/dismissed). */
export function isProblemOpen(status: string): boolean {
  return (OPEN_PROBLEM_STATUSES as string[]).includes(status);
}

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

/** Per TT.md A21 Command Center audit — distinct "live-error"
 *  so the UI surfaces "couldn't load" honestly. */
export type ProblemsMode =
  | "live-data"
  | "live-empty"
  | "demo-fixtures"
  | "live-error";

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

  if (error) return { problems: [], mode: "live-error" };
  if (!data) return { problems: [], mode: "live-empty" };

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
