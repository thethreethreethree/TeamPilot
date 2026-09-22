/**
 * The Pitch Score API's response shapes, as the server actually sends them.
 *
 * MIRRORED, NOT RE-DERIVED. Every type here was read off the routes and
 * `src/lib/coach/pitchScore/aggregate.ts` in the web repository on 2026-09-22, and this file
 * contains NO arithmetic — no averaging, no banding, no lowest-section rule, no qualification
 * test. The server computes all of it and this app renders what it is handed.
 *
 * That restraint is the whole point. The web build's own register records four duplicated
 * decisions in a single day (a manager predicate, a lowest-section helper, a band table, a score
 * band) and states what they had in common: *"Every one of them was correct on the day it was
 * written. That is what makes the class invisible — a duplicate is never wrong when you write
 * it."* One of them shipped a page where 95 read Elite in one card and Strong in the card beneath.
 *
 * A phone that recomputes any of this would be the fifth, and it would be the worst of them,
 * because the two copies would sit on different devices and nobody would ever see them disagree.
 *
 * WHAT A REP MAY SEE IS NOT DECIDED HERE EITHER. The founder ruled on 2026-09-22 that when the
 * rubric sheet and `SalesCoach-KPI-System.md` disagree about anything a rep sees, the KPI document
 * wins — a distance you can close is a target and survives, a rank and a cushion are positions and
 * do not. The leaderboard route strips `rank`, `boardSize` and `gaps.ahead` before they leave the
 * server. So those fields are typed as absent-or-null here, and any component must branch on
 * whether the field is PRESENT, never on a role flag: a value that never arrives cannot be leaked
 * by a rendering bug, but a component that asks "am I a manager?" can get that wrong.
 */

/**
 * The period toggle lives in `period.ts`, with the guard that checks the server honoured it.
 *
 * RE-EXPORTED, NOT REDECLARED. It was declared here first and in `period.ts` second — two copies of
 * a four-string union, inside the very pair of files whose docblocks warn about duplicated
 * decisions. Caught before either had a consumer, and the copies agreed, which is exactly the
 * property that makes this class invisible.
 */
import type { Period } from '@/lib/pitch-score/period';

export type { Period };

/** The six rubric sections. Ids are the server's, verbatim. */
export type SectionId =
  | 'introduction'
  | 'discovery'
  | 'consulting'
  | 'close'
  | 'transitions'
  | 'delivery';

export type Grade = 'hit' | 'partial' | 'missed';

export type ElementStat = {
  elementId: string;
  section: SectionId;
  label: string;
  maxPoints: number;
  /** points x (hitRate + partialRate/2) — average points earned per counted pitch. */
  avgPoints: number;
  hitRate: number;
  partialRate: number;
  missedRate: number;
  /** Counted pitches this element was GRADED in. The rates are over this, not over all. */
  gradedIn: number;
};

export type BonusStat = {
  bonusId: string;
  label: string;
  /** Share of counted pitches where it was earned at least once. */
  earnedInRate: number;
  avgPoints: number;
};

export type ViolationStat = {
  violationId: string;
  label: string;
  rate: number;
  /** A POSITIVE magnitude. The minus sign belongs to the display, not the data. */
  avgDeduction: number;
};

export type PeriodAggregate = {
  /** Every pitch handed in, qualifying or not. */
  pitchesTotal: number;
  /** Qualifying pitches — the denominator for every average below. */
  counted: number;
  notCounted: number;
  /**
   * Why the excluded ones were excluded, keyed by reason.
   *
   * This exists so a board can say "5 didn't reach Discovery or scored under 40 base" instead of
   * leaving a rep to infer it from the number on the row. Qualification is judged on BASE and the
   * list displays TOTAL, so two rows can show near-identical numbers with opposite counted status
   * and nothing on screen explains it unless this is rendered.
   */
  notCountedReasons: Record<string, number>;

  totalPoints: number;
  avgPitchScore: number;
  avgBase: number;
  /** Already capped per pitch before averaging. Never cap this again — see the note below. */
  avgBonus: number;
  avgViolations: number;
  bestPitchScore: number | null;

  /** Per section, averaged over counted pitches. Sums to `avgBase`. */
  sectionAverages: Record<SectionId, number>;
  elementStats: ElementStat[];
  bonusStats: BonusStat[];
  violationStats: ViolationStat[];

  prizeEligible: boolean;
};

/**
 * `GET /api/coach/sales-session/pitch-score/breakdown?period=…`
 *
 * `capped` and `skippedPreVerdict` are the read's verdict on itself. A truncated period is not the
 * period, and a board that averages over a bound it silently hit is reporting a different number
 * from the one it names. Render them; do not drop them because they are usually false.
 */
export type BreakdownResponse = {
  period: Period;
  aggregate: PeriodAggregate;
  skippedPreVerdict: number;
  capped: boolean;
};

/**
 * The rep's own standing. No other rep's name or total ever appears in it.
 *
 * Note what is NOT here: `rank`, `boardSize`, and `gaps.ahead`. See the docblock at the top.
 */
export type Standing = {
  repId: string;
  total_points: number;
  counted: number;
  pitchesTotal: number;
  avgPitchScore: number;
  bestPitchScore: number | null;
  prizeEligible: boolean;
};

export type LeaderboardResponse = {
  period: Period;
  /** False for a rep. When false, the position fields were stripped server-side. */
  managerView: boolean;
  standing: Standing | null;
  /**
   * `behind` is how far below the rep immediately above — a distance that can be closed, which the
   * ruling keeps. `ahead` is a cushion that can be lost, which it does not, and arrives null.
   */
  gaps: { behind: number | null; ahead: number | null };
  skippedPreVerdict: number;
  capped: boolean;
  /** Manager-only, and therefore optional on this client. Absent for a rep. */
  rank?: number;
  boardSize?: number;
};

export const MILESTONE_KEYS = [
  'firstPitch',
  'tripleDigits',
  'inTheDoor',
  'fullBundle',
  'cleanSweep',
  'century',
] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

/** Earned-at dates, or null where unearned. The server derives them; this app only reads. */
export type MilestoneDates = Record<MilestoneKey, string | null>;

export type MilestonesResponse = {
  repId: string;
  milestones: MilestoneDates;
  /**
   * The reader hit its 900-row bound.
   *
   * Harmless for every badge here and reported anyway. The route reads OLDEST FIRST precisely so
   * the cap costs a rep their most RECENT pitches, which no "first" or "hundredth" depends on —
   * a newest-first read would have dated "First pitch" to a rep's 900th-most-recent one. It is
   * mirrored because a badge added later might depend on the latest pitch, and a field the client
   * never typed is a field nobody notices has started mattering.
   */
  capped: boolean;
};

/** One of the rep's highest counted pitches. */
export type BestPitch = {
  pitchId: string;
  /**
   * Null when the session was deleted.
   *
   * `pitch_scores.session_id` is `on delete set null`, so a pitch outlives its recording. The SCORE
   * is still real, so the card is still shown — without a tap, rather than offering one that goes
   * nowhere.
   */
  sessionId: string | null;
  recordedAt: string;
  /** The Pitch Score, 0-130. Ranked on this, not on base. */
  total: number;
  outcome: string | null;
};

export type BestPitchesResponse = {
  period: Period;
  pitches: BestPitch[];
};
