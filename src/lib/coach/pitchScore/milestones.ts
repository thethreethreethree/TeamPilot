import { ELEMENTS } from "./rubric";
import type { AggregablePitch } from "./aggregate";

/**
 * Pitch Score milestones — the rep dashboard's MILESTONES strip.
 *
 * SPECIFIED. The six badges and their captions are read from the rep dashboard sheet, which is in
 * the tree at `docs/SYSTEM UPDATES AND REVISION/EloState Rep Pitch Dashboard.pdf`. Its text:
 *
 *     First pitch     Triple digits
 *     In the door
 *     Full bundle     "DTV + Wireless + ADT in one pitch"
 *     Clean sweep     "Every phase fully hit"
 *     Century         "100 scored pitches"
 *
 * Two of those captions are the reason this module was not written from the badge names. **Clean
 * sweep is "every phase fully hit", not "no violations"** — the obvious reading, and wrong. And
 * Full bundle names its three products explicitly rather than meaning "several bonuses". A build
 * that inferred both from the names would have shipped two badges that fire on the wrong pitches
 * and look entirely plausible doing it.
 *
 * `tripleDigits` and `inTheDoor` carry no caption on the sheet and ARE inferred: 100+ on a scale
 * that reaches 130, and the rubric's own `bonus.inside` ("Gets inside the house or backyard").
 * Both are marked below so the next reader can tell which definitions came from the sheet.
 *
 * THESE ARE NOT THE GAMIFICATION MILESTONES, and the distinction is the whole reason this file
 * exists separately from `gamification/milestones.ts`:
 *
 *   | | gamification | here |
 *   |---|---|---|
 *   | first badge | first SESSION on the points ledger | first COUNTED pitch |
 *   | century | 100 sessions | 100 counted PITCHES |
 *
 * A rep records sessions that never qualify, so the two counts diverge permanently and the same
 * rep hits them on different days. Merging them would mean choosing one denominator and silently
 * moving every earned-at date; `gamification/milestones.ts` derives its dates from the immutable
 * ledger precisely so they cannot move. So both sets stand, and the gamification labels were
 * changed to say "session" where they used to say "pitch".
 */

export const PITCH_MILESTONE_KEYS = [
  "firstPitch",
  "tripleDigits",
  "inTheDoor",
  "fullBundle",
  "cleanSweep",
  "century",
] as const;
export type PitchMilestoneKey = (typeof PITCH_MILESTONE_KEYS)[number];

export const PITCH_MILESTONE_TITLES: Record<PitchMilestoneKey, string> = {
  firstPitch: "First pitch",
  tripleDigits: "Triple digits",
  inTheDoor: "In the door",
  fullBundle: "Full bundle",
  cleanSweep: "Clean sweep",
  century: "Century",
};

/** The sheet's own captions, where it gave one. Empty where the badge name stands alone. */
export const PITCH_MILESTONE_CAPTIONS: Record<PitchMilestoneKey, string> = {
  firstPitch: "Your first counted pitch",
  tripleDigits: "A single pitch over 100",
  inTheDoor: "Inside the house or backyard",
  fullBundle: "DTV + Wireless + ADT in one pitch",
  cleanSweep: "Every phase fully hit",
  century: "100 scored pitches",
};

/** The three products "Full bundle" names, from the sheet. Not "any three bonuses". */
const BUNDLE_BONUSES = ["bonus.directv", "bonus.wireless", "bonus.adt"] as const;

/** A single pitch over 100. Inferred from the badge name and the 0-130 scale. */
const TRIPLE_DIGITS_MIN = 100;

/** The number of counted pitches "Century" means, from the sheet. */
const CENTURY_COUNT = 100;

export type PitchMilestoneDates = Record<PitchMilestoneKey, string | null>;

/** Every element id, grouped by section — the denominator for "every phase fully hit". */
const ELEMENTS_BY_SECTION = (() => {
  const map = new Map<string, string[]>();
  for (const e of ELEMENTS) {
    const list = map.get(e.section) ?? [];
    list.push(e.id);
    map.set(e.section, list);
  }
  return map;
})();

/**
 * Did this pitch hit EVERY element of EVERY phase?
 *
 * "Fully" is read strictly: a Partial is not a hit. The sheet says *fully* hit, and a badge that
 * accepted partials would be earned on a pitch the breakdown screen shows in amber — the rep would
 * be looking at a Clean sweep badge above a section with a PARTIAL in it.
 *
 * An element the current rubric no longer knows cannot stop a sweep, and it needs no guard to be
 * ignored: the loop below asks whether every CURRENT id is in the hit set, so an extra id in that
 * set is unreachable by construction. A `ELEMENTS_BY_ID.has(...)` filter here was removed after a
 * mutation proved it changed nothing — a guard that guards nothing reads as protection and is one
 * more line to keep true.
 */
function isCleanSweep(pitch: AggregablePitch): boolean {
  const hit = new Set(
    pitch.elements.filter((e) => e.grade === "hit").map((e) => e.elementId)
  );
  for (const [, ids] of ELEMENTS_BY_SECTION) {
    if (!ids.every((id) => hit.has(id))) return false;
  }
  return true;
}

/** Which bonuses this pitch actually earned. A rejected bonus awarded nothing and is not here. */
function awardedBonuses(pitch: AggregablePitch): Set<string> {
  return new Set(
    (pitch.score.bonusBreakdown ?? [])
      .filter((b) => b.points > 0)
      .map((b) => b.bonusId)
  );
}

/**
 * Derive each milestone's earned-at from a rep's pitches.
 *
 * COUNTED PITCHES ONLY, everywhere. A pitch that did not qualify is not a scored pitch — it did
 * not reach Discovery or it fell under 40 base — and letting one earn a badge would hand a rep
 * "First pitch" for a conversation the leaderboard refuses to count.
 *
 * Input need not be sorted; it is sorted ascending here so "first" and "hundredth" are unambiguous.
 * A pitch with no `recordedAt` is dropped: a milestone is a DATE, and one with an unknown date
 * cannot be placed on a strip that shows when it was earned.
 */
export function derivePitchMilestones(
  pitches: ReadonlyArray<AggregablePitch>
): PitchMilestoneDates {
  const counted = pitches
    .filter((p) => p.score.qualifying && p.recordedAt)
    .sort((a, b) => (a.recordedAt! < b.recordedAt! ? -1 : a.recordedAt! > b.recordedAt! ? 1 : 0));

  const firstWhere = (pred: (p: AggregablePitch) => boolean): string | null =>
    counted.find(pred)?.recordedAt ?? null;

  return {
    firstPitch: counted[0]?.recordedAt ?? null,
    tripleDigits: firstWhere((p) => p.score.total >= TRIPLE_DIGITS_MIN),
    inTheDoor: firstWhere((p) => awardedBonuses(p).has("bonus.inside")),
    fullBundle: firstWhere((p) => {
      const got = awardedBonuses(p);
      return BUNDLE_BONUSES.every((b) => got.has(b));
    }),
    cleanSweep: firstWhere(isCleanSweep),
    century:
      counted.length >= CENTURY_COUNT ? (counted[CENTURY_COUNT - 1]?.recordedAt ?? null) : null,
  };
}
