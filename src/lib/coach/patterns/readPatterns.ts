import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { ELEMENTS_BY_ID, BONUSES_BY_ID, VIOLATIONS_BY_ID, type Grade } from "../pitchScore/rubric";
import { statusOf, countPatterns, type StatusVerdict } from "./status";
import type { GradedPitch } from "./detect";

/**
 * Load a rep's patterns for the Pattern Interrupt boards, each with its resolved status.
 *
 * READ THROUGH THE CALLER'S CLIENT, for the reason `readPitchPeriod` gives and one more specific
 * to this table. `patterns` RLS says "your own row, or any in your company if you manage", which
 * is the launch checklist's last line — *"Reps only ever see their own patterns and recordings."*
 * Passing the caller's client makes that policy the access rule rather than whatever this module
 * remembered to filter on. A service-role client here would hand a rep the whole team's habits.
 *
 * THE STATUS IS RESOLVED HERE, ONCE, AND TRAVELS AS A VERDICT. Five surfaces want to know whether
 * a pattern is open — the manager chips, the rep-progress list, the four count cards, the team
 * roll-up and the rep's own board — and C8 is the record of what happens when two of them decide
 * for themselves. `statusOf` is the single author (§2.2); nothing downstream may write
 * `status !== "fixed"`.
 */

/** A pattern with everything a board needs to draw it, and nothing it would have to derive. */
export type PatternRow = {
  id: string;
  repId: string;
  itemId: string;
  itemKind: "element" | "bonus" | "violation";
  /** Human label from the rubric, falling back to the raw id so an unknown item still renders. */
  label: string;
  /** "INTRODUCTION · TRUCKS / NEIGHBORHOOD NOTICE" — the board's breadcrumb line. */
  section: string | null;
  firstSeen: string;
  missesAtDetection: number;
  applicableAtDetection: number;
  costPerPitch: number;
  /** Newest-first grades, the dot strip as it was at detection. */
  strip: Grade[];
  /** ISO instant of the earliest coaching_started-equivalent event, or null. */
  coachedAt: string | null;
  fixedAt: string | null;
  /** True once the rep has acknowledged it — drives AWAITING REP REVIEW. */
  repReviewed: boolean;
  verdict: StatusVerdict;
  /** Whole days since detection. The board's OPEN column reads "9 days". */
  daysOpen: number;
};

export type PatternsRead = {
  patterns: PatternRow[];
  counts: ReturnType<typeof countPatterns>;
  /** The read hit its bound, so this is part of a rep's patterns rather than all of them. */
  capped: boolean;
  /**
   * Has anything been scored for this scope at all?
   *
   * The distinction the empty state is built on, and the reason it lives here rather than at the
   * route: "no patterns found" and "nothing has looked" render identically and are opposite facts,
   * and on this screen the wrong one reads as praise. Answering it needs the grades read, which
   * this module owns.
   */
  scored: boolean;
};

/** Bound, for the same reason every other read here has one: PostgREST caps at 1000. */
const LIMIT = 500;

const DAY_MS = 86_400_000;

/** Kinds that mean "a human engaged with this", per the guide: coached, a drill, or a note. */
const COACHING_KINDS = new Set(["coached", "drill_assigned", "note"]);

type PatternRecord = {
  id: string;
  rep_id: string;
  item_id: string;
  item_kind: PatternRow["itemKind"];
  first_seen: string;
  misses_at_detection: number;
  applicable_at_detection: number;
  cost_per_pitch: number | string;
  strip_at_detection: string[] | null;
  fixed_at: string | null;
};

type EventRecord = { pattern_id: string; kind: string; created_at: string };

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0) || 0);

/**
 * Label and section for a rubric item of any of the three kinds.
 *
 * Falls back to the raw id rather than to "Unknown". A pattern whose item has been retired from
 * the rubric still happened, and a card reading "close.askForSale" is ugly and true, where a card
 * reading "Unknown" is tidy and tells a manager nothing they can act on.
 */
function describe(itemId: string, kind: PatternRow["itemKind"]): { label: string; section: string | null } {
  if (kind === "element") {
    const el = ELEMENTS_BY_ID.get(itemId);
    return { label: el?.label ?? itemId, section: el?.section ?? null };
  }
  if (kind === "bonus") return { label: BONUSES_BY_ID.get(itemId)?.label ?? itemId, section: "bonus" };
  return { label: VIOLATIONS_BY_ID.get(itemId)?.label ?? itemId, section: "violation" };
}

/**
 * Per-rep open-pattern counts — the manager board's chips.
 *
 * `Humza Khan 3 · Anthony A. 3 · James Soto 3 · Knute Knudtson 2 · John Knudtson 1`, and on the
 * board those five sum to the ACTIVE PATTERNS card above them. They sum because both numbers come
 * from the same verdicts: this counts `verdict.open`, the card reads `counts.open`, and neither
 * decides for itself what open means (C8, §2.2). A chip row that did its own filtering would
 * disagree with the card above it the first time Improving was handled differently — which is
 * exactly the disagreement C8 recorded in the mockups.
 *
 * Sorted by count descending, then by id so the order is stable between loads. A board whose chips
 * reshuffle on every poll is one a manager cannot point at.
 */
export function repChips(patterns: readonly PatternRow[]) {
  const byRep = new Map<string, number>();
  for (const p of patterns) {
    if (!p.verdict.open) continue;
    byRep.set(p.repId, (byRep.get(p.repId) ?? 0) + 1);
  }
  return [...byRep.entries()]
    .map(([repId, open]) => ({ repId, open }))
    .sort((a, b) => b.open - a.open || a.repId.localeCompare(b.repId));
}

export async function readPatterns(
  args: {
    /**
     * REQUIRED with a service-role client and optional with a caller-scoped one, exactly as
     * `readPitchPeriod` requires it: RLS filters the second and does not exist for the first.
     *
     * OMITTING IT IS THE TEAM READ, and it is safe only through a caller-scoped client: the
     * `patterns` policy is "own row, or any in your company if you manage", so a manager gets the
     * team and a rep gets themselves from the same query. The route does not decide who sees what
     * — that answer is in the database, in one place, and cannot drift from the RLS that also
     * governs direct queries (§2.2).
     */
    repId?: string;
    /**
     * Applicable grades, keyed by rep and then by item.
     *
     * OPTIONAL, and normally omitted: this function reads the pattern rows first, learns which
     * reps actually have patterns, and fetches grades only for those. A caller cannot know that
     * list in advance without doing the same read twice, and on a team board the difference is
     * between one query per rep-with-a-pattern and one per rep in the company.
     *
     * Supplied only by tests, which is why the injection point exists at all.
     */
    gradesByRep?: ReadonlyMap<string, ReadonlyMap<string, readonly GradedPitch[]>>;
    now?: Date;
    limit?: number;
  },
  db?: SupabaseClient
): Promise<PatternsRead | null> {
  const supabase = db ?? (await createServerClient());
  const limit = args.limit ?? LIMIT;

  let q = supabase
    .from("patterns")
    .select("id, rep_id, item_id, item_kind, first_seen, misses_at_detection, applicable_at_detection, cost_per_pitch, strip_at_detection, fixed_at")
    .order("first_seen", { ascending: false })
    .limit(limit);
  if (args.repId) q = q.eq("rep_id", args.repId);

  const { data, error } = await q;
  if (error || !data) return null;

  const records = data as PatternRecord[];
  if (records.length === 0) {
    // ONE EXTRA QUERY, only in the case where the answer matters. With no patterns the board has
    // to choose between "nothing has been missed three times" (a finding) and "nothing has been
    // scored yet" (an absence), and nothing else on this path can tell them apart. A rep WITH
    // patterns never pays for this.
    const scored = args.repId ? (await readApplicableGrades({ repId: args.repId }, supabase)).size > 0 : false;
    return { patterns: [], counts: countPatterns([]), capped: false, scored };
  }

  // One events read for every pattern, rather than one per pattern. The board shows up to a
  // dozen patterns across five reps and an N+1 here would be a dozen round trips to render a
  // page that already waits on the grades read.
  const { data: eventData } = await supabase
    .from("pattern_events")
    .select("pattern_id, kind, created_at")
    .in("pattern_id", records.map((r) => r.id))
    .order("created_at", { ascending: true });

  const events = (eventData ?? []) as EventRecord[];
  const coachedAt = new Map<string, string>();
  const reviewed = new Set<string>();
  for (const e of events) {
    // EARLIEST coaching event wins, and the read is ordered ascending so the first one seen is it.
    // "Coached 7+ days ago" means since coaching STARTED; taking the latest would let a manager
    // reset a stalled pattern's clock by adding a note to it.
    if (COACHING_KINDS.has(e.kind) && !coachedAt.has(e.pattern_id)) coachedAt.set(e.pattern_id, e.created_at);
    if (e.kind === "rep_reviewed") reviewed.add(e.pattern_id);
  }

  /**
   * Grades for exactly the reps who have a pattern, read AFTER the rows rather than before.
   *
   * One query per such rep. Bounded by how many people actually have a repeated miss, not by
   * headcount — a company of forty where three reps have patterns does three reads, and a rep
   * reading their own board does one. Named here rather than hidden because it is the first thing
   * to measure if this page feels slow (and because "N+1" is easier to fix than to notice).
   *
   * Sequential rather than parallel on purpose: this runs behind a caller-scoped client against a
   * pooled connection, and a manager opening the board should not fire twenty simultaneous reads
   * to save a few hundred milliseconds on a page that already waited for the rows.
   */
  const repIds = [...new Set(records.map((r) => r.rep_id))];
  const gradesByRep = new Map<string, ReadonlyMap<string, readonly GradedPitch[]>>();
  if (args.gradesByRep) {
    for (const [k, v] of args.gradesByRep) gradesByRep.set(k, v);
  } else {
    for (const id of repIds) {
      gradesByRep.set(id, await readApplicableGrades({ repId: id }, supabase));
    }
  }

  const now = args.now ?? new Date();
  const patterns = records.map((r): PatternRow => {
    const { label, section } = describe(r.item_id, r.item_kind);
    const verdict = statusOf({
      applicable: gradesByRep.get(r.rep_id)?.get(r.item_id) ?? [],
      coachedAt: coachedAt.get(r.id) ?? null,
      fixedAt: r.fixed_at,
      now,
    });
    return {
      id: r.id,
      repId: r.rep_id,
      itemId: r.item_id,
      itemKind: r.item_kind,
      label,
      section,
      firstSeen: r.first_seen,
      missesAtDetection: r.misses_at_detection,
      applicableAtDetection: r.applicable_at_detection,
      costPerPitch: num(r.cost_per_pitch),
      strip: (r.strip_at_detection ?? []) as Grade[],
      coachedAt: coachedAt.get(r.id) ?? null,
      fixedAt: r.fixed_at,
      repReviewed: reviewed.has(r.id),
      verdict,
      // Floor, not round: a pattern found four hours ago is open "0 days", not "1 day". The board
      // prints this next to a coaching date and a manager reads the two together.
      daysOpen: Math.max(0, Math.floor((now.getTime() - Date.parse(r.first_seen)) / DAY_MS)),
    };
  });

  return {
    patterns,
    counts: countPatterns(patterns.map((p) => p.verdict)),
    capped: records.length >= limit,
    // A pattern exists, so something was necessarily scored to find it.
    scored: true,
  };
}

/**
 * Patterns shared by 3+ reps — the board's TEAM-WIDE PATTERN banner.
 *
 * Guide step 5: *"when 3+ reps have an open pattern on the same item, show it at the top of the
 * Patterns tab with 'Add to team brief'."* Counts REPS, not patterns, and only OPEN ones —
 * `verdict.open` is consumed, never recomputed. A rep with two patterns on one item counts once,
 * which is why this is a Set rather than a tally.
 */
export function teamWidePatterns(patterns: readonly PatternRow[], minReps = 3) {
  const repsByItem = new Map<string, Set<string>>();
  const labels = new Map<string, string>();
  for (const p of patterns) {
    if (!p.verdict.open) continue;
    labels.set(p.itemId, p.label);
    const set = repsByItem.get(p.itemId) ?? new Set<string>();
    set.add(p.repId);
    repsByItem.set(p.itemId, set);
  }
  return [...repsByItem.entries()]
    .filter(([, reps]) => reps.size >= minReps)
    .map(([itemId, reps]) => ({ itemId, label: labels.get(itemId) ?? itemId, repIds: [...reps] }))
    .sort((a, b) => b.repIds.length - a.repIds.length);
}

/**
 * Every applicable grade for a rep, keyed by rubric item — the input the status resolver compares.
 *
 * APPLICABILITY IS ROW PRESENCE, and that is the whole reason this read is a plain select rather
 * than something cleverer. `pitch_score_elements` has `unique (pitch_id, element_id)` and the
 * scorer writes a row only when the element was graded, so "the last 10 pitches where it applied"
 * is just this rep's rows for that item. There is no not-applicable value to filter out, and
 * inventing one would be a second source of truth for a fact the schema already carries (C4).
 *
 * The inner join to `pitch_scores` is what supplies `recorded_at` — the elements table has only
 * `created_at`, which is when the SCORER ran. Ordering a rep's history by when a machine got
 * round to it would put a re-scored pitch from last week at the front of "the last 10".
 */
export async function readApplicableGrades(
  args: { repId: string; limit?: number },
  db?: SupabaseClient
): Promise<Map<string, GradedPitch[]>> {
  const supabase = db ?? (await createServerClient());
  // Generous but bounded: 10 applicable pitches per item across ~30 items is 300 rows, and a
  // prolific rep over a long period is the case that would silently truncate.
  const limit = args.limit ?? 900;

  const { data, error } = await supabase
    .from("pitch_score_elements")
    .select("element_id, grade, points, pitch_id, pitch_scores!inner(rep_id, recorded_at)")
    .eq("pitch_scores.rep_id", args.repId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const byItem = new Map<string, GradedPitch[]>();
  if (error || !data) return byItem;

  for (const row of data as unknown as Array<{
    element_id: string;
    grade: Grade;
    points: number | string;
    pitch_id: string;
    pitch_scores: { rep_id: string; recorded_at: string } | Array<{ rep_id: string; recorded_at: string }>;
  }>) {
    // PostgREST returns an embedded row as an object for a to-one join and an array for to-many;
    // the shape depends on how it reads the FK, so both are handled rather than assumed.
    const parent = Array.isArray(row.pitch_scores) ? row.pitch_scores[0] : row.pitch_scores;
    if (!parent?.recorded_at) continue;
    const list = byItem.get(row.element_id) ?? [];
    list.push({
      pitchId: row.pitch_id,
      recordedAt: parent.recorded_at,
      grade: row.grade,
      points: num(row.points),
    });
    byItem.set(row.element_id, list);
  }
  return byItem;
}
