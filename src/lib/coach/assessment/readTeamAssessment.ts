import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { readPitchPeriod } from "../pitchScore/readPitchPeriod";
import {
  aggregatePitches,
  computeActivityKpis,
  sumTeamTotals,
  type ActivityKpis,
  type PeriodAggregate,
} from "../pitchScore/aggregate";
import { lowestSection, SECTIONS, PRIZE_ELIGIBLE_MIN_PITCHES, type SectionId } from "../pitchScore/rubric";
import {
  sectionBars,
  priorityCards,
  rankReps,
  prizeEligibleCount,
  type RepRow,
  type SectionBar,
  type PriorityCard,
  type BriefTheme,
} from "./teamAssessment";

/**
 * The Coach Assessment manager dashboard's read — guide Step 3, items 1, 2, 3, 5 and 6.
 *
 * ALMOST NOTHING IS COMPUTED HERE. Every number already has an owner and this assembles them:
 *
 *   · `readPitchPeriod` + `aggregatePitches` — the per-rep score picture, the same pair the rep's
 *     own Breakdown board uses, so a manager and a rep looking at one period cannot see different
 *     section averages.
 *   · `computeActivityKpis` — doors, presentations, sold and the two ratios. It also encodes the
 *     founder's 2026-09-11 definition of a presentation (doors spoken to, NOT recorded pitches),
 *     which the build guide still lists as an open decision. The product decided; this consumes
 *     the decision rather than re-opening it.
 *   · `sumTeamTotals` — the roll-up, written so the launch checklist's "rep totals sum to team
 *     totals" holds by construction rather than by coincidence.
 *   · `lowestSection` — by percentage of max (C1), never a Math.min over six averages.
 *
 * The one thing this module does own is the SHAPE: which reads happen, in what order, and what a
 * failure in each costs.
 *
 * DOORS COME FROM `rep_kpi_daily`, which is a VIEW over `door_knocks` grouped by
 * (company, rep, local_date) with `security_invoker = on`. A physical `rep_activity` table was
 * written for this and deleted before it shipped: the view has a superset of its columns and
 * cannot go stale, so the table would have been a cache of a live view over the same rows.
 */

export type RepDetail = {
  aggregate: PeriodAggregate;
  kpis: ActivityKpis;
};

export type TeamAssessment = {
  period: { from: string | null; to: string | null };
  team: {
    aggregate: PeriodAggregate;
    kpis: ActivityKpis;
    totalPoints: number;
    counted: number;
    pitchesTotal: number;
    prizeEligible: number;
    repCount: number;
    minPitchesForPrize: number;
  };
  bars: SectionBar[];
  priorities: PriorityCard[];
  reps: RepRow[];
  /** Per-rep detail, keyed by rep id — the Overview tab's numbers. */
  detail: Record<string, RepDetail>;
  /** The read hit its bound, so the period is partly covered. Reported, never inferred. */
  capped: boolean;
  /**
   * Scored pitches with no rep attached, excluded from every figure above.
   *
   * Zero in practice; surfaced because the alternative to reporting them is folding them into a
   * team average where they would break the sum-to-rows identity with nothing on screen saying so.
   */
  unattributed: number;
};

type DailyKpiRow = {
  rep_id: string;
  doors_knocked: number | string;
  sold: number | string;
  no_answer: number | string;
};

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0) || 0);

/**
 * Load everything the dashboard draws, for one company and one period.
 *
 * READ THROUGH THE CALLER'S CLIENT. `pitch_scores` and `rep_kpi_daily` are both RLS-scoped to
 * "own row or company manager", so passing the caller's client makes the policy the access rule.
 * A rep who reaches this route gets their own figures presented as a one-person team, which is
 * harmless and honest; a manager gets the company. There is no second access check here to drift
 * from the first (§2.2).
 */
export async function readTeamAssessment(
  args: {
    companyId: string;
    from?: string;
    to?: string;
    /** The brief's themes, already loaded by the caller — this module does not generate them. */
    themes?: readonly BriefTheme[];
    /** One line per rep from the brief, keyed by rep NAME as the brief writes it. */
    focusByName?: ReadonlyMap<string, string>;
    /** Existing coaching grade per rep, so the new board keeps what the old page showed. */
    gradeByRep?: ReadonlyMap<string, { grade: string | null; note: string | null }>;
    nameByRep?: ReadonlyMap<string, string>;
    limit?: number;
  },
  db?: SupabaseClient
): Promise<TeamAssessment | null> {
  const supabase = db ?? (await createServerClient());

  // 900, not the 500 default — the same bound the leaderboard and breakdown routes use. A team
  // period is the largest read in the product and truncating it silently would make every average
  // on the page a partial one.
  const read = await readPitchPeriod(
    {
      companyId: args.companyId,
      ...(args.from ? { from: args.from } : {}),
      ...(args.to ? { to: args.to } : {}),
      limit: args.limit ?? 900,
    },
    supabase
  );
  if (read === null) return null;

  // Doors and sold, from the view. One read for the whole company and period.
  let dailyQ = supabase
    .from("rep_kpi_daily")
    .select("rep_id, doors_knocked, sold, no_answer")
    .eq("company_id", args.companyId);
  if (args.from) dailyQ = dailyQ.gte("local_date", args.from.slice(0, 10));
  if (args.to) dailyQ = dailyQ.lte("local_date", args.to.slice(0, 10));
  const { data: dailyData } = await dailyQ;

  const activityByRep = new Map<string, { doors: number; sold: number; noAnswer: number }>();
  for (const row of (dailyData ?? []) as DailyKpiRow[]) {
    const cur = activityByRep.get(row.rep_id) ?? { doors: 0, sold: 0, noAnswer: 0 };
    cur.doors += num(row.doors_knocked);
    cur.sold += num(row.sold);
    cur.noAnswer += num(row.no_answer);
    activityByRep.set(row.rep_id, cur);
  }

  // Group the period's pitches by rep. Every rep with EITHER a scored pitch or door activity
  // appears — a rep who knocked all week and recorded nothing is exactly who a manager needs to
  // see, and dropping them because they have no Pitch Score would hide that.
  const pitchesByRep = new Map<string, typeof read.pitches>();
  let unattributed = 0;
  for (const p of read.pitches) {
    // `repId` is optional on AggregablePitch. A pitch without one cannot be attributed to a row
    // in the reps table — it is counted here and reported rather than silently folded into the
    // team totals, because a team average that includes pitches no rep is charged with would not
    // reconcile against the sum of its rows, and the launch checklist requires that it does.
    if (!p.repId) {
      unattributed++;
      continue;
    }
    const list = pitchesByRep.get(p.repId) ?? [];
    list.push(p);
    pitchesByRep.set(p.repId, list);
  }
  const repIds = [...new Set([...pitchesByRep.keys(), ...activityByRep.keys()])];

  const detail: Record<string, RepDetail> = {};
  const perRepForTotals: Array<{ totalPoints: number; counted: number; kpis: ActivityKpis }> = [];
  const rows: RepRow[] = [];

  for (const repId of repIds) {
    const aggregate = aggregatePitches(pitchesByRep.get(repId) ?? []);
    const act = activityByRep.get(repId) ?? { doors: 0, sold: 0, noAnswer: 0 };
    const kpis = computeActivityKpis({
      doorsKnocked: act.doors,
      // The founder's 2026-09-11 definition, consumed rather than restated.
      doorsSpokenTo: Math.max(0, act.doors - act.noAnswer),
      sold: act.sold,
      recordedPitches: aggregate.pitchesTotal,
    });

    detail[repId] = { aggregate, kpis };
    perRepForTotals.push({ totalPoints: aggregate.totalPoints, counted: aggregate.counted, kpis });

    const worst = aggregate.counted > 0 ? lowestSection(aggregate.sectionAverages) : null;
    const name = args.nameByRep?.get(repId) ?? null;
    const grade = args.gradeByRep?.get(repId);
    rows.push({
      repId,
      fullName: name,
      avgPitchScore: aggregate.avgPitchScore,
      band: null, // the surface consumes bands.ts; a band computed here would be a second copy
      totalPoints: aggregate.totalPoints,
      doors: kpis.doorsKnocked,
      presentations: kpis.presentations,
      sold: kpis.sold,
      closeRate: kpis.closeRate === null ? null : Math.round(kpis.closeRate * 1000) / 10,
      lowestSection: worst,
      lowestSectionLabel: worst ? SECTIONS.find((s) => s.id === worst)?.label ?? null : null,
      coachingGrade: grade?.grade ?? null,
      coachingGradeNote: grade?.note ?? null,
      // Matched on the name the brief used, which is how the brief itself keys repFocus.
      focus: (name && args.focusByName?.get(name)) ?? null,
    });
  }

  const totals = sumTeamTotals(perRepForTotals);
  // Aggregated over the ATTRIBUTED pitches only, which is the same set the rep rows are built
  // from. Using `read.pitches` here instead would make the team average include pitches that
  // appear in no row, and the checklist's "rep totals sum to team totals" would quietly fail.
  const attributed = [...pitchesByRep.values()].flat();
  const teamAggregate = aggregatePitches(attributed);
  const bars = sectionBars(teamAggregate.sectionAverages as Record<SectionId, number>);

  return {
    period: { from: args.from ?? null, to: args.to ?? null },
    team: {
      aggregate: teamAggregate,
      kpis: computeActivityKpis({
        doorsKnocked: totals.doorsKnocked,
        doorsSpokenTo: Math.max(
          0,
          totals.doorsKnocked - [...activityByRep.values()].reduce((s, a) => s + a.noAnswer, 0)
        ),
        sold: totals.sold,
        recordedPitches: teamAggregate.pitchesTotal,
      }),
      totalPoints: totals.totalPoints,
      counted: totals.counted,
      pitchesTotal: teamAggregate.pitchesTotal,
      prizeEligible: prizeEligibleCount(
        Object.values(detail).map((d) => d.aggregate),
        PRIZE_ELIGIBLE_MIN_PITCHES
      ),
      repCount: repIds.length,
      minPitchesForPrize: PRIZE_ELIGIBLE_MIN_PITCHES,
    },
    bars,
    priorities: priorityCards(args.themes ?? [], bars),
    reps: rankReps(rows),
    detail,
    capped: read.capped,
    unattributed,
  };
}
