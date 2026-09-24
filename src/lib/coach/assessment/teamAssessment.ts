import {
  SECTIONS,
  ELEMENTS,
  lowestSection,
  type SectionId,
} from "../pitchScore/rubric";
import type { PeriodAggregate } from "../pitchScore/aggregate";

/**
 * The Coach Assessment manager dashboard — the arithmetic behind guide Step 3.
 *
 * Pure functions only. The read layer supplies the numbers; this decides what they mean, so the
 * rules can be argued with in a test instead of inside a JSX tree.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: decide which section is lowest, or which band a score is
 * in. Both already have authorities — `lowestSection` in `rubric.ts` (by PERCENTAGE of max, not
 * absolute points, per C1) and `bandFor` in `bands.ts`. A hand-rolled `Math.min` over six
 * averages here would disagree with the rep's own Breakdown board the first time a section was
 * low in points and high as a fraction of its maximum, which is exactly the collision
 * `TWO-SCORING-SYSTEMS.md` was written after (§2.2).
 */

// ── Team activity (Step 3 item 2) ─────────────────────────────────────────────────────────────
//
// NOTHING HERE. This module had an `activityRates()` when it was first written — presentations ÷
// doors and sold ÷ presentations, returning null on an empty denominator, with a comment
// explaining why null and not zero.
//
// `computeActivityKpis` in `../pitchScore/aggregate.ts` already did all of that, including the
// null-not-zero rule and nearly the same comment. Worse, it also settles a question I was about
// to answer for myself: `countPresentations` records *"doors_knocked − no_answer … the founder's
// 2026-09-11 definition"*, which is the guide's page-8 open decision ALREADY DECIDED, the other
// way from what the mockups assume, and kept "one argument away" from being flipped back.
//
// So the dashboard consumes `computeActivityKpis`. Writing a second one was the §2.2 duplicate
// this file's own header warns about, committed by the author of the warning, twenty minutes
// after writing it — which is the most useful thing this build found out about the class.

// ── Team rubric averages (Step 3 item 3) ──────────────────────────────────────────────────────

export type SectionBar = {
  id: SectionId;
  label: string;
  avg: number;
  max: number;
  /** The single flagged section. Exactly one is true when any section has been scored. */
  lowest: boolean;
  /** Points a perfect run of this section would add per pitch. The priority cards' currency. */
  pointsLeft: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Six bars, lowest flagged — and the flag comes from the rubric's own authority.
 *
 * `lowestSection` is by percentage of max. Delivery averaging 23.9 of 35 (68%) is a bigger
 * absolute gap than Close at 8.6 of 15 (57%), and the rubric says Close is the lower one. The
 * board agrees: its LOWEST tag sits on Close at 8.6/15 while Delivery shows 23.9/35 untagged.
 */
export function sectionBars(sectionAverages: Readonly<Record<SectionId, number>>): SectionBar[] {
  const worst = lowestSection(sectionAverages);
  return SECTIONS.map((s) => {
    const avg = r1(sectionAverages[s.id] ?? 0);
    return {
      id: s.id,
      label: s.label,
      avg,
      max: s.maxPoints,
      lowest: s.id === worst,
      pointsLeft: r1(Math.max(0, s.maxPoints - avg)),
    };
  });
}

// ── What the team needs to work on (Step 3 item 5) ────────────────────────────────────────────

export type BriefTheme = { title: string; why: string };

export type PriorityCard = {
  rank: 1 | 2 | 3;
  section: SectionId;
  sectionLabel: string;
  title: string;
  why: string;
  teamAvg: number;
  max: number;
  pointsLeft: number;
  /**
   * Did the theme's own words name this section, or was it assigned?
   *
   * The guide says "map each priority to a rubric section" and the brief has no section on a
   * theme — the themes come from pooled v5 growth areas, a different vocabulary from the six
   * rubric sections. So the match is computed, and when the wording does not line up the section
   * is assigned by largest remaining gap. A surface that cannot tell the two apart would present
   * an assignment as a finding; this field is how it can.
   */
  matched: boolean;
};

/**
 * Meaningful tokens, stemmed, so a theme written in a manager's words can reach a rubric phrase
 * written in the sheet's words.
 *
 * Substring matching was the first attempt and it failed on the obvious case: the theme "Bridge
 * the phases instead of narrating the script … say the TRANSITION out loud" does not contain the
 * string "transitions", so it matched nothing and fell through to assignment. Tokens with the
 * plural stripped fix that without loosening anything else — a token has to be a whole word.
 *
 * Tokens under four characters are dropped ("to", "the", "and"), which also stops "Intro to
 * Discovery" from requiring the word "to" to be present.
 */
const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 4)
    .map((t) => (t.endsWith("s") ? t.slice(0, -1) : t));

/** Phrases that point at a section: its own label, plus every element label inside it. */
function sectionVocabulary(): Array<{ id: SectionId; phrases: string[][] }> {
  return SECTIONS.map((s) => ({
    id: s.id,
    phrases: [
      tokens(s.label),
      ...ELEMENTS.filter((e) => e.section === s.id).map((e) => tokens(e.label)),
    ].filter((p) => p.length > 0),
  }));
}

/**
 * Three priority cards from the existing brief, each carrying a section's real numbers.
 *
 * THE NUMBERS ARE NEVER THE THEME'S. Team average and points-per-pitch left are facts about a
 * rubric section, computed from the aggregate. The theme supplies the words. Where a theme names
 * no section, the card still gets real numbers — they just belong to a section chosen by gap
 * rather than by the theme, and `matched: false` says so.
 *
 * Deterministic throughout: a section is used at most once, matching runs before assignment, and
 * assignment takes the largest remaining `pointsLeft`. Two managers opening the same period see
 * the same three cards.
 */
export function priorityCards(
  themes: readonly BriefTheme[],
  bars: readonly SectionBar[]
): PriorityCard[] {
  const vocab = sectionVocabulary();
  const byId = new Map(bars.map((b) => [b.id, b]));
  const used = new Set<SectionId>();
  const top = themes.slice(0, 3);

  const matchOf = (t: BriefTheme): SectionId | null => {
    const hay = new Set(tokens(`${t.title} ${t.why}`));
    // A phrase matches only if EVERY one of its tokens is present, and the longest matching
    // phrase wins — so "speed test" beats a bare "speed" that lives in two sections, and a theme
    // naming one element does not capture a section on an incidental word.
    const hits = vocab
      .filter((v) => !used.has(v.id))
      .map((v) => ({
        id: v.id,
        best: Math.max(0, ...v.phrases.filter((p) => p.every((tok) => hay.has(tok))).map((p) => p.length)),
      }))
      .filter((h) => h.best > 0)
      .sort((a, b) => b.best - a.best || a.id.localeCompare(b.id));
    return hits[0]?.id ?? null;
  };

  // Pass one: every theme that names a section takes it. Done before any assignment so a theme
  // with a real match cannot lose its section to an earlier theme's fallback.
  const assigned = new Map<number, SectionId>();
  const wasMatched = new Set<number>();
  top.forEach((t, i) => {
    const m = matchOf(t);
    if (m) {
      assigned.set(i, m);
      wasMatched.add(i);
      used.add(m);
    }
  });

  // Pass two: the rest take the largest remaining gap.
  const remaining = [...bars]
    .filter((b) => !used.has(b.id))
    .sort((a, b) => b.pointsLeft - a.pointsLeft || a.id.localeCompare(b.id));
  top.forEach((_, i) => {
    if (assigned.has(i)) return;
    const next = remaining.shift();
    if (next) {
      assigned.set(i, next.id);
      used.add(next.id);
    }
  });

  const out: PriorityCard[] = [];
  top.forEach((t, i) => {
    const id = assigned.get(i);
    if (!id) return; // fewer sections than themes — cannot happen with six, but never invent one
    const bar = byId.get(id);
    if (!bar) return;
    out.push({
      rank: (i + 1) as 1 | 2 | 3,
      section: id,
      sectionLabel: bar.label,
      title: t.title,
      why: t.why,
      teamAvg: bar.avg,
      max: bar.max,
      pointsLeft: bar.pointsLeft,
      matched: wasMatched.has(i),
    });
  });
  return out;
}

// ── The reps table (Step 3 item 6) ────────────────────────────────────────────────────────────

export type RepRow = {
  repId: string;
  fullName: string | null;
  avgPitchScore: number;
  band: string | null;
  totalPoints: number;
  doors: number;
  presentations: number;
  sold: number;
  /**
   * A PERCENTAGE — 12.9 means 12.9%. NOT a ratio.
   *
   * `readTeamAssessment.ts:196` converts it (`Math.round(r * 1000) / 10`) before it reaches the
   * wire, so the surface renders it as `${r.closeRate}%` with no arithmetic.
   *
   * THE TRAP: `ActivityKpis.closeRate` — same name, same response object, reached as
   * `wire.team.kpis.closeRate` and `wire.detail[repId].kpis.closeRate` — is a RATIO (0.129), and
   * the board renders THOSE through `pct()`, which multiplies by 100.
   *
   * So one payload carries `closeRate` in two units. Every consumer happens to match today.
   * Picking the wrong renderer is a number wrong by 100x on a manager's screen, with nothing
   * throwing. See docs/DEMO-READINESS-2026-09-24.md for why the rename that removes this
   * (`closeRatePct`) was deferred: it changes a wire key, and a browser on the previous bundle
   * would render "undefined%".
   */
  closeRate: number | null;
  lowestSection: SectionId | null;
  lowestSectionLabel: string | null;
  /**
   * NO COACHING GRADE ON THE WIRE, deliberately.
   *
   * The guide requires the column — *"the existing coaching grade and notes stay unranked"* — and
   * it is on the board. It is NOT here, because `AgentGradeBadge` fetches it from the endpoint
   * that has always owned it, so putting it on this row would be a second copy of a number one
   * request away (§2.2).
   *
   * This started as two always-null fields and was removed once the badge proved they were never
   * needed. An unadopted field is the debt `fetchJson.ts` is labelled with in the reachability
   * audit: "adopted by nothing… Nobody decided this should be unused."
   */
  /** The rep's one line from the brief, or null when the brief does not cover them. */
  focus: string | null;
};

/**
 * Rank by TOTAL POINTS, which is the guide's instruction and not a default.
 *
 * *"Rank by total points … The existing coaching grade and notes stay unranked; only the Pitch
 * Score and KPIs are compared across reps."* So the grade is displayed and never ordered by, and
 * the average Pitch Score is displayed and never ordered by either — points reward volume, which
 * is the rubric's own stated competition metric, and a table sorted by average would put a rep
 * with three good pitches above a rep with forty.
 *
 * Ties break by name so the order is stable between loads.
 */
export function rankReps(rows: readonly RepRow[]): RepRow[] {
  return [...rows].sort(
    (a, b) => b.totalPoints - a.totalPoints || (a.fullName ?? a.repId).localeCompare(b.fullName ?? b.repId)
  );
}

/**
 * A rep's figures against the team's, for the detail panel's "−53% vs. team avg".
 *
 * Percentage difference for counts, PERCENTAGE POINTS for things already expressed as a rate —
 * the board is explicit about the difference ("−53% vs. team avg" on doors, "−3 pts vs. team" on
 * the door-to-presentation rate). Saying "−21% vs team" about two percentages is the error that
 * makes a manager think a rep converts a fifth as often as they do.
 */
export function vsTeam(rep: number | null, team: number | null, kind: "count" | "rate") {
  if (rep === null || team === null) return null;
  if (kind === "rate") return { delta: r1(rep - team), unit: "pts" as const };
  if (team === 0) return null;
  return { delta: Math.round(((rep - team) / team) * 100), unit: "%" as const };
}

/** Prize eligibility, from the rubric: 5 counted pitches. Consumed, not re-derived. */
export function prizeEligibleCount(perRep: readonly PeriodAggregate[], minPitches: number): number {
  return perRep.filter((a) => a.counted >= minPitches).length;
}
