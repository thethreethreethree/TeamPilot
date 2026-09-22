import type { PatternRow } from "./readPatterns";
import { countPatterns } from "./status";

/**
 * The Rep progress board — Project 5's second tab, from the render opened 2026-09-22.
 *
 * EVERY NUMBER HERE IS A DERIVATION OVER `PatternRow`. No new table, no new column, no second
 * resolver: `statusOf` decided each pattern's status and `verdict.open` its openness, and this
 * module only groups, counts and sorts what came back. That is the first build in this cycle that
 * needed no migration, and it is not a coincidence — the C8 ruling put `open` in a field, and a
 * field can be counted from anywhere without being re-decided (§2.2).
 *
 * THE ONE JUDGEMENT THIS FILE MAKES, and the reason it is written down. The board sorts its rep
 * list "NEEDS ATTENTION FIRST" and prints a pill beside each name: Needs 1:1, Follow up, New rep,
 * On track. Nothing in the guide defines those. A11 says the system mirrors rather than judges, so
 * the rule below is a SORT OVER FACTS THE REP CAN CHECK — how many of their patterns are stalled,
 * how many have never been coached — never a score and never a trait. "Two of these have been
 * open a week without coaching" is a mirror; "this person needs a 1:1" is a verdict, and the pill
 * is only allowed to be shorthand for the first.
 *
 * A10 FOLLOWS FROM THAT. A pill is a judgement printed beside a person's name on a screen they
 * cannot open. `attentionReason` exists so the same sentence can be shown to the rep, and a rep
 * discovering secondhand that the product filed them under "Needs 1:1" is worse than the pill not
 * existing at all.
 */

const DAY_MS = 86_400_000;

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The five team cards
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

export type TeamCards = {
  /** OPEN PATTERNS. Anything not Fixed, per the founder's C8 ruling, consumed not recomputed. */
  openPatterns: number;
  /** "Across N reps" — reps with at least one OPEN pattern, not reps with any pattern. */
  acrossReps: number;
  /** FIXED THIS MONTH. Calendar month of `now`, because the card says "this month". */
  fixedThisMonth: number;
  /** "Avg N days to fix". Null when nothing has been fixed — never 0.0, which reads as instant. */
  avgDaysToFix: number | null;
  stalled: number;
  /** AWAITING REP REVIEW — coached, and the rep has not acknowledged it. */
  awaitingRepReview: number;
  /** POINTS RECOVERED, per pitch, team total: the cost of every FIXED pattern, no longer paid. */
  pointsRecovered: number;
};

/**
 * Roll the team's patterns up to the five cards.
 *
 * `avgDaysToFix` IS NULLABLE AND MUST STAY THAT WAY. A team that has fixed nothing has no average,
 * and 0.0 in that tile reads as "fixed instantly" — the confident zero this codebase has an
 * invariant against, pointed at a coaching metric. Same rule as every other empty aggregate here.
 *
 * `pointsRecovered` counts ONLY fixed patterns. An open pattern's cost is still being paid, and
 * including it would let a manager watch "points recovered" rise while nothing had been fixed.
 */
export function teamCards(patterns: readonly PatternRow[], now: Date): TeamCards {
  const counts = countPatterns(patterns.map((p) => p.verdict));

  const repsWithOpen = new Set<string>();
  for (const p of patterns) if (p.verdict.open) repsWithOpen.add(p.repId);

  const fixed = patterns.filter((p) => !p.verdict.open);
  const fixedThisMonth = fixed.filter((p) => {
    const at = fixedInstant(p);
    if (at === null) return false;
    const d = new Date(at);
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
  });

  const spans = fixed.map(daysToFix).filter((d): d is number => d !== null);

  return {
    openPatterns: counts.open,
    acrossReps: repsWithOpen.size,
    fixedThisMonth: fixedThisMonth.length,
    avgDaysToFix: spans.length === 0 ? null : round1(spans.reduce((a, b) => a + b, 0) / spans.length),
    stalled: counts.stalled,
    awaitingRepReview: patterns.filter((p) => p.coachedAt !== null && !p.repReviewed).length,
    pointsRecovered: round1(fixed.reduce((sum, p) => sum + p.costPerPitch, 0)),
  };
}

/**
 * When a pattern was fixed.
 *
 * TWO WAYS TO BE FIXED and only one of them writes a column. `fixed_at` is set when a manager
 * closes a pattern by hand; a pattern cleared by five clean pitches in a row has no `fixed_at` at
 * all, and its closing moment is the `fixed` event the detector appends. Reading only the column
 * would make every auto-cleared pattern invisible to "FIXED THIS MONTH" — which is the majority
 * of them, since the whole point of the streak rule is that the rep fixes it themselves.
 */
function fixedInstant(p: PatternRow): string | null {
  if (p.fixedAt) return p.fixedAt;
  const ev = eventsOf(p)
    .filter((e) => e.kind === "fixed")
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  return ev?.at ?? null;
}

/**
 * `p.events` at the WIRE BOUNDARY, where the type is a promise and not a guarantee.
 *
 * These derivations run in two places: server-side over rows this codebase just built, where the
 * array always exists, and client-side over JSON. A browser holds its bundle across a deploy, so
 * a client compiled against today's shape can be handed yesterday's response — and `events` is a
 * field that did not exist yesterday. `undefined.filter` there does not degrade the timeline, it
 * throws through `useMemo` and takes the whole tab down.
 *
 * Found by a test fixture written without the field, which is exactly the state that response is
 * in. One line, at the one place every reader goes through.
 */
function eventsOf(p: PatternRow): PatternRow["events"] {
  return Array.isArray(p.events) ? p.events : [];
}

/** First seen → fixed, in whole days. Null when the pattern is open or its close is undated. */
function daysToFix(p: PatternRow): number | null {
  const at = fixedInstant(p);
  if (at === null) return null;
  const span = (Date.parse(at) - Date.parse(p.firstSeen)) / DAY_MS;
  return Number.isFinite(span) && span >= 0 ? span : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The rep list
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

/** The board's four pills. */
export type AttentionLevel = "needs_1_1" | "follow_up" | "new_rep" | "on_track";

export type RepProgressRow = {
  repId: string;
  fullName: string | null;
  /** The three-segment bar, and the "N fixed · N improving · N open" line under it. */
  fixed: number;
  improving: number;
  /** The board's third number EXCLUDES improving — `openNotImproving`, not `open`. */
  stillOpen: number;
  /** The panel's tile, which INCLUDES improving. Both, from one resolver, as the board shows. */
  openTotal: number;
  attention: AttentionLevel;
  /** The same sentence in both directions: shown to the manager, showable to the rep (A10). */
  attentionReason: string;
};

/**
 * Order the reps, and say why each one sits where it does.
 *
 * NAMED `rankRepsByAttention` AND NOT `rankReps`, checked before writing (A21). The Coach
 * Assessment board already exports a `rankReps` that orders by TOTAL POINTS — a different board,
 * a different ordering, and a different meaning of "first". Two `rankReps` in one product is the
 * shape where someone imports the wrong one and gets a plausible list in the wrong order, which
 * no type error and no test would catch because both return reps.
 *
 * THE RULE, and it is deliberately dull:
 *
 *   needs_1_1   any STALLED pattern — coaching happened and did not take
 *   follow_up   any pattern open a week or more with no coaching at all
 *   new_rep     patterns, but none coached and none old enough to be overdue
 *   on_track    everything else, including a rep with nothing open
 *
 * Every one of those is a countable fact about rows the rep can see. None is a judgement about
 * the person, and that is the line A11 draws: the board may say "two of these stalled", it may not
 * say "struggling". The pill is shorthand for the sentence, and the sentence travels with it.
 *
 * SORTED BY THE SAME FACTS, most-attention first, then by how many are open, then by name so the
 * order is stable between renders. A list that reshuffles on tie is a list a manager cannot scan
 * twice.
 */
export function rankRepsByAttention(
  patterns: readonly PatternRow[],
  nameByRep: ReadonlyMap<string, string>,
  now: Date
): RepProgressRow[] {
  const byRep = new Map<string, PatternRow[]>();
  for (const p of patterns) {
    const list = byRep.get(p.repId) ?? [];
    list.push(p);
    byRep.set(p.repId, list);
  }

  const rows = [...byRep.entries()].map(([repId, own]): RepProgressRow => {
    const counts = countPatterns(own.map((p) => p.verdict));
    const stalled = own.filter((p) => p.verdict.status === "stalled");
    const uncoachedOverdue = own.filter(
      (p) =>
        p.verdict.open &&
        p.coachedAt === null &&
        (now.getTime() - Date.parse(p.firstSeen)) / DAY_MS >= OVERDUE_DAYS
    );

    let attention: AttentionLevel;
    let attentionReason: string;
    if (stalled.length > 0) {
      attention = "needs_1_1";
      attentionReason = `${plural(stalled.length, "pattern")} coached over a week ago with no change since`;
    } else if (uncoachedOverdue.length > 0) {
      attention = "follow_up";
      attentionReason = `${plural(uncoachedOverdue.length, "pattern")} open a week or more, never coached`;
    } else if (counts.open > 0 && own.every((p) => p.coachedAt === null)) {
      attention = "new_rep";
      attentionReason = "Patterns found, none coached yet";
    } else {
      attention = "on_track";
      attentionReason =
        counts.open === 0 ? "Nothing open" : "Everything open is being worked on";
    }

    return {
      repId,
      fullName: nameByRep.get(repId) ?? null,
      fixed: counts.fixed,
      improving: counts.improving,
      stillOpen: counts.openNotImproving,
      openTotal: counts.open,
      attention,
      attentionReason,
    };
  });

  return rows.sort(
    (a, b) =>
      ORDER[a.attention] - ORDER[b.attention] ||
      b.openTotal - a.openTotal ||
      (a.fullName ?? a.repId).localeCompare(b.fullName ?? b.repId)
  );
}

/** A pattern nobody has coached after this many days is overdue, matching STALLED_AFTER_DAYS. */
export const OVERDUE_DAYS = 7;

const ORDER: Record<AttentionLevel, number> = {
  needs_1_1: 0,
  follow_up: 1,
  new_rep: 2,
  on_track: 3,
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The rep panel
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

export type RepTiles = {
  openPatterns: number;
  /** "1 not coached yet" — the sub-line under Open patterns. */
  notCoachedYet: number;
  fixed: number;
  /** Null when this rep has fixed nothing. The tile says so rather than printing 0.0. */
  avgDaysToFix: number | null;
  /** "+2.3 · Per pitch, from fixed patterns". */
  pointsRecovered: number;
  /** "2/2 · Coached patterns acknowledged". Denominator is COACHED patterns, not all of them. */
  reviewed: number;
  reviewable: number;
};

/**
 * The rep panel's five tiles.
 *
 * `reviewable` IS THE COACHED COUNT, not the total. The board reads "2/2 Coached patterns
 * acknowledged" beside a rep with three open patterns, one of which has never been coached — so
 * the denominator excludes it. A rep cannot acknowledge coaching that has not happened, and a
 * tile reading 2/3 would ask them to.
 */
export function repTiles(own: readonly PatternRow[]): RepTiles {
  const counts = countPatterns(own.map((p) => p.verdict));
  const fixed = own.filter((p) => !p.verdict.open);
  const spans = fixed.map(daysToFix).filter((d): d is number => d !== null);
  const coached = own.filter((p) => p.coachedAt !== null);

  return {
    openPatterns: counts.open,
    notCoachedYet: own.filter((p) => p.verdict.open && p.coachedAt === null).length,
    fixed: fixed.length,
    avgDaysToFix: spans.length === 0 ? null : round1(spans.reduce((a, b) => a + b, 0) / spans.length),
    pointsRecovered: round1(fixed.reduce((s, p) => s + p.costPerPitch, 0)),
    reviewed: coached.filter((p) => p.repReviewed).length,
    reviewable: coached.length,
  };
}

export type RepAlert = { kind: "stalled" | "waiting_on_you"; text: string };

/**
 * The pink box: what a manager should know before the table.
 *
 * TWO KINDS, and the board distinguishes them because they ask for different actions. `Stalled` is
 * "you coached this and it did not take — try something else in a 1:1". `Waiting on you` is
 * "nobody has coached this at all". Merging them into "needs attention" would send a manager to
 * repeat an approach that has already failed.
 *
 * Derived from the same verdicts the table renders, so the box can never flag a row the table
 * shows as fine.
 */
export function repAlerts(own: readonly PatternRow[], now: Date): RepAlert[] {
  const out: RepAlert[] = [];

  for (const p of own.filter((x) => x.verdict.status === "stalled")) {
    // The resolver already worded the "why". Re-phrasing it here would be a second author for a
    // sentence a manager reads twice on one screen — once in the box, once in the table's reason.
    out.push({
      kind: "stalled",
      text: `“${p.label}” ${lowerFirst(p.verdict.reason)}. Try a different approach in a 1:1.`,
    });
  }

  for (const p of own.filter(
    (x) =>
      x.verdict.open &&
      x.coachedAt === null &&
      (now.getTime() - Date.parse(x.firstSeen)) / DAY_MS >= OVERDUE_DAYS
  )) {
    out.push({
      kind: "waiting_on_you",
      text: `“${p.label}” has been open ${p.daysOpen} days without coaching.`,
    });
  }

  return out;
}

const lowerFirst = (s: string) => (s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s);

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The check-in agenda
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

export type AgendaItem = {
  /** What to do, in the imperative — the board numbers these 1, 2, 3. */
  text: string;
  /** The pattern it refers to, so "Open clips" knows which one. */
  patternId: string;
  /** Why this item is on the list, shown on hover and in the record. Never a hidden ranking. */
  because: string;
};

/**
 * NEXT CHECK-IN AGENDA — three items, derived, never generated.
 *
 * THIS IS THE MOST §3.3-EXPOSED THING ON THE BOARD and the reason it is a derivation rather than a
 * model call. It is three numbered instructions about a named person, and §3.3 is explicit that
 * the System asks the human what they think before asserting its own answer, precisely so an
 * accurate-but-unwelcome reading stays survivable.
 *
 * So each item is a STATEMENT OF WHAT IS ON THE RECORD with a verb attached — "this one stalled,
 * replay a clip"; "this one is at two clean in a row, say so"; "this one has never been coached,
 * introduce it" — and each carries `because`. A manager can disagree with an item by disagreeing
 * with a fact, which is the only kind of advice this product is allowed to give.
 *
 * ORDERED stalled → improving → uncoached, matching the board, because that is also the order of
 * decreasing urgency and increasing pleasantness. Ending a check-in on the new thing rather than
 * the failed thing is not a trick; it is the shape the board drew.
 */
export function checkInAgenda(own: readonly PatternRow[], max = 3): AgendaItem[] {
  const out: AgendaItem[] = [];
  // ONE ITEM PER PATTERN. The three passes below have disjoint conditions in real data — a
  // Stalled pattern always has a coaching date, because that is what Stalled means — but they are
  // three independent filters over one array, and nothing structural stops a row matching two of
  // them. Found by a test whose fixture was internally inconsistent, which is exactly the state
  // real data reaches after a partial write: an agenda that says "call out the progress" and
  // "introduce it" about the same pattern is worse than either line alone.
  const seen = new Set<string>();
  const add = (item: AgendaItem) => {
    if (seen.has(item.patternId)) return;
    seen.add(item.patternId);
    out.push(item);
  };

  for (const p of own.filter((x) => x.verdict.status === "stalled")) {
    add({
      patternId: p.id,
      text: `Replay one missed clip of “${p.label}” together, then role play the fix live.`,
      because: p.verdict.reason,
    });
  }

  for (const p of own.filter((x) => x.verdict.status === "improving")) {
    add({
      patternId: p.id,
      text:
        p.verdict.streak > 0
          ? `Call out the progress on “${p.label}” (${p.verdict.streak} clean in a row).`
          : `Call out the progress on “${p.label}”.`,
      because: p.verdict.reason,
    });
  }

  for (const p of own.filter((x) => x.verdict.open && x.coachedAt === null)) {
    add({
      patternId: p.id,
      text: `Introduce “${p.label}” and play the clips.`,
      because: "Never coached",
    });
  }

  return out.slice(0, max);
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The timeline
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

export type TimelineMarker = { kind: string; at: string; /** 0–1 across the window. */ x: number };

export type TimelineBar = {
  patternId: string;
  label: string;
  status: PatternRow["verdict"]["status"];
  /** 0–1 across the window. Clamped, and `clippedStart` says when clamping hid something. */
  from: number;
  to: number;
  /** True when the pattern began before the window and the bar starts at its left edge. */
  clippedStart: boolean;
  markers: TimelineMarker[];
};

/**
 * Lay the patterns out across a date window — the board's "Pattern timeline · September".
 *
 * CLAMPING IS VISIBLE, never silent. A pattern first seen in August drawn from the left edge of a
 * September window looks like a pattern that started on 1 September, and a manager reading the bar
 * would date the problem wrong by a month. `clippedStart` is how the surface says "this runs off
 * the left".
 *
 * A marker whose event falls outside the window is DROPPED rather than pinned to an edge, for the
 * same reason a null timestamp is not drawn at zero: a Ⓒ at the left edge is a specific claim that
 * coaching happened on the first of the month.
 */
export function timeline(
  own: readonly PatternRow[],
  window: { from: Date; to: Date }
): TimelineBar[] {
  const start = window.from.getTime();
  const end = window.to.getTime();
  const span = end - start;
  if (!(span > 0)) return [];

  const pos = (t: number) => Math.max(0, Math.min(1, (t - start) / span));

  return own.map((p): TimelineBar => {
    const began = Date.parse(p.firstSeen);
    const closed = fixedInstant(p);
    const ended = closed ? Date.parse(closed) : end;

    return {
      patternId: p.id,
      label: p.label,
      status: p.verdict.status,
      from: pos(began),
      to: pos(ended),
      clippedStart: began < start,
      markers: eventsOf(p)
        .filter((e) => MARKER_KINDS.has(e.kind))
        .map((e) => ({ kind: e.kind, at: e.at, t: Date.parse(e.at) }))
        .filter((e) => Number.isFinite(e.t) && e.t >= start && e.t <= end)
        .map(({ kind, at, t }) => ({ kind, at, x: pos(t) })),
    };
  });
}

/** The three the board's legend draws: Ⓒ Coached · Ⓓ Drill assigned · Ⓡ Rep reviewed. */
const MARKER_KINDS: ReadonlySet<string> = new Set(["coached", "drill_assigned", "rep_reviewed"]);
