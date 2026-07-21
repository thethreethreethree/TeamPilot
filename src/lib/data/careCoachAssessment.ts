/**
 * C.A.R.E Coach Assessment — per-agent coaching roster for managers (founder 2026-07-22).
 *
 * This is the Sales-Coach-style per-agent view brought to C.A.R.E, WITH the founder's explicit sign-off
 * to override the stricter aggregate-only stance fetchTeamGrowth took. It therefore carries the SAME
 * §A18 guardrails the Sales Coach Coach Assessment uses:
 *   - roster is ALWAYS alphabetical, NEVER sorted by grade (not a leaderboard);
 *   - each agent is graded against a fixed competent-reply standard, never against peers;
 *   - the letter is coaching-framed (no "F", floor is "growth area") and travels with its raw counts (§A11);
 *   - manager-only (the route enforces CEO/COO/admin).
 *
 * Option A (founder-chosen): the grade + learning gaps are derived from data we ALREADY compute — the
 * per-reply `coach_counts` (Coach v6) rolled up per agent. No new instrumentation, no migration.
 *
 * §3.4 honest-error: if the read fails, throw so the route 500s and the page shows an honest error, never
 * a false "everyone's at zero".
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { careQualityScore, type CareCoachAggregate } from "@/lib/care/careQualityGrade";
import { deriveLearningGaps, type LearningGap } from "@/lib/care/careLearningGaps";

// Re-exported so existing importers of LearningGap from this module keep working.
export type { LearningGap };

export type CoachAssessmentAgent = {
  agentId: string;
  agentName: string;
  /** Raw counts — the §A11 basis. The letter grade is derived from these client-side (gradeCareAggregate). */
  aggregate: CareCoachAggregate;
  /** Up to two book-grounded coaching targets, worst-first. Empty when the agent is solid or has no data. */
  learningGaps: LearningGap[];
  /** §3.6 make-learning-visible: the Care Quality score for each of the last 4 weeks, OLDEST→NEWEST.
   *  null for a week with no graded replies. So growth is a line, not a flat snapshot. */
  trajectory: Array<number | null>;
};

export type CoachAssessmentRoster = {
  companyId: string;
  windowDays: number;
  /** Agents with graded replies, ALPHABETICAL (never grade-sorted — §A18). */
  agents: CoachAssessmentAgent[];
  /** Team members with no graded replies yet (surfaced so nobody is silently invisible). */
  noData: string[];
  /** True if a scan hit the row cap (metrics undercount — §3.4 honesty). */
  bounded: boolean;
};


type CoachCountsShape = {
  positive?: { acknowledged?: number; answered?: number; next_step?: number };
  risks?: {
    unsupported_absolutes?: number;
    fabricated_specifics?: number;
    empty_filler?: number;
  };
} | null;

const SCAN_CAP = 1000;

/**
 * Per-agent coaching roster for a company's C.A.R.E managers. Reads the last 30 days of graded agent
 * replies (`coach_counts`), rolls them up by author, and returns an alphabetical roster (§A18) with the
 * raw counts (§A11 basis) + book-grounded learning gaps. The letter grade is computed client-side from
 * the aggregate (gradeCareAggregate) so the counts stay the source of truth.
 */
export async function fetchCoachAssessmentRoster(
  companyId: string
): Promise<CoachAssessmentRoster> {
  const sb = await createServerClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [agentsRes, coachRes] = await Promise.all([
    sb
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId)
      .or("is_support_agent.eq.true,role.in.(CEO,COO,admin)"),
    sb
      .from("support_messages")
      .select("author_id, coach_counts, created_at, support_conversations!inner(company_id)")
      .eq("author_type", "agent")
      .eq("is_internal_note", false)
      .eq("support_conversations.company_id", companyId)
      .not("coach_counts", "is", null)
      .not("author_id", "is", null)
      .gte("created_at", since),
  ]);

  // §3.4 — a failed read throws (route 500s → honest error state), never a false empty roster.
  if (agentsRes.error) throw new Error(`care coach-assessment: agents read failed — ${agentsRes.error.message}`);
  if (coachRes.error) throw new Error(`care coach-assessment: counts read failed — ${coachRes.error.message}`);

  const agents = (agentsRes.data ?? []) as { id: string; full_name: string | null }[];
  const nameById = new Map(agents.map((a) => [a.id, a.full_name]));

  const rows = (coachRes.data ?? []) as unknown as Array<{
    author_id: string | null;
    coach_counts: CoachCountsShape;
    created_at: string;
  }>;
  const bounded = rows.length >= SCAN_CAP;

  // Roll up by author — a total aggregate AND four weekly buckets (for the §3.6 trajectory).
  const TRAJ_WEEKS = 4;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const emptyAgg = (): CareCoachAggregate => ({
    repliesGraded: 0,
    acknowledgedCount: 0,
    answeredCount: 0,
    nextStepCount: 0,
    risks: { unsupportedAbsolutes: 0, fabricatedSpecifics: 0, emptyFiller: 0 },
  });
  const accumulate = (agg: CareCoachAggregate, c: NonNullable<CoachCountsShape>) => {
    agg.repliesGraded += 1;
    agg.acknowledgedCount += c.positive?.acknowledged ?? 0;
    agg.answeredCount += c.positive?.answered ?? 0;
    agg.nextStepCount += c.positive?.next_step ?? 0;
    agg.risks.unsupportedAbsolutes += c.risks?.unsupported_absolutes ?? 0;
    agg.risks.fabricatedSpecifics += c.risks?.fabricated_specifics ?? 0;
    agg.risks.emptyFiller += c.risks?.empty_filler ?? 0;
  };

  const byAgent = new Map<string, CareCoachAggregate>();
  const byAgentWeek = new Map<string, CareCoachAggregate[]>(); // index 0 = most recent week
  for (const row of rows) {
    const id = row.author_id;
    const c = row.coach_counts;
    if (!id || !c) continue;
    let agg = byAgent.get(id);
    if (!agg) {
      agg = emptyAgg();
      byAgent.set(id, agg);
    }
    accumulate(agg, c);

    let weeks = byAgentWeek.get(id);
    if (!weeks) {
      weeks = Array.from({ length: TRAJ_WEEKS }, emptyAgg);
      byAgentWeek.set(id, weeks);
    }
    const age = now - new Date(row.created_at).getTime();
    const wi = Math.min(TRAJ_WEEKS - 1, Math.max(0, Math.floor(age / WEEK_MS)));
    const bucket = weeks[wi];
    if (bucket) accumulate(bucket, c);
  }

  const withData: CoachAssessmentAgent[] = [];
  for (const [agentId, aggregate] of byAgent.entries()) {
    const weeks = byAgentWeek.get(agentId) ?? [];
    // Oldest → newest, so the line reads left-to-right as time.
    const trajectory: Array<number | null> = [];
    for (let i = TRAJ_WEEKS - 1; i >= 0; i--) {
      const wk = weeks[i];
      trajectory.push(wk && wk.repliesGraded > 0 ? careQualityScore(wk) : null);
    }
    withData.push({
      agentId,
      agentName: nameById.get(agentId) ?? "Unnamed agent",
      aggregate,
      learningGaps: deriveLearningGaps(aggregate),
      trajectory,
    });
  }
  // §A18 guardrail: ALWAYS alphabetical, NEVER sorted by grade.
  withData.sort((a, b) => a.agentName.localeCompare(b.agentName));

  const withDataIds = new Set(withData.map((a) => a.agentId));
  const noData = agents
    .filter((a) => !withDataIds.has(a.id))
    .map((a) => a.full_name ?? "Unnamed agent")
    .sort((a, b) => a.localeCompare(b));

  return { companyId, windowDays: 30, agents: withData, noData, bounded };
}
