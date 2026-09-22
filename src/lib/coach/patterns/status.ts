import {
  cleanStreak,
  missedOnly,
  doneRight,
  type GradedPitch,
  type MissPredicate,
  type CleanPredicate,
} from "./detect";

/**
 * THE status authority for Pattern Interrupt. One function, one verdict, every surface consumes it.
 *
 * WHY THIS FILE EXISTS AT ALL, which is the important part:
 *
 * The mockups defined "open" twice. The manager rep-chips and the rep-detail panel count Improving
 * as open (Anthony A. = 3); the rep-progress list excludes it ("1 fixed · 1 improving · 2 open").
 * Same rep, same moment, two numbers — recorded as C8 in
 * `docs/SYSTEM UPDATES AND REVISION 09-22-2026/LOGIC-AND-CONTRADICTIONS.md`, and ruled by the founder
 * (2026-09-22): **open = status ≠ Fixed.**
 *
 * §2.2 is why the ruling lives in a returned FIELD rather than in a documented convention. The
 * derivation is one line. A one-line derivation is exactly the kind that gets re-typed at each
 * call site, and a re-typed condition drifts — the leaderboard, the chips, the rep list and the
 * team roll-up would each own a copy, four of them would agree, and the fifth would quietly
 * reinstate the contradiction the founder just ruled out. So `open` is computed here, once, and a
 * consumer that wants to disagree has to delete something rather than forget something.
 *
 * NO STATUS COLUMN (§3.1). Status is derived by replaying: the append-only `pattern_events` log
 * plus the rep's applicable grades since detection. Nothing updates a row to say "improving".
 */

/** The lifecycle from the build guide's Step 5. Ordered New → Coaching → Improving/Stalled → Fixed. */
export type PatternStatus = "new" | "coaching" | "improving" | "stalled" | "fixed";

/** Clean applicable pitches in a row that clear a pattern automatically. */
export const CLEAN_STREAK_TO_FIX = 5;

/** Days after coaching, with no streak and no improvement, at which a pattern is Stalled. */
export const STALLED_AFTER_DAYS = 7;

/**
 * Applicable pitches compared at each end of the window.
 *
 * FIVE, from the guide: "Miss rate in the last 5 applicable pitches is lower than the first 5."
 * The Rep progress board prints both figures in a column headed MISSES THEN → NOW, reading
 * "4/5 → 1/5 ▼" — so the denominator is on screen and this constant is what it means.
 */
export const COMPARISON_WINDOW = 5;

export type StatusInput = {
  /**
   * EVERY applicable pitch for this item, any order. The comparison takes the first
   * COMPARISON_WINDOW and the last COMPARISON_WINDOW from this list.
   *
   * CORRECTED 2026-09-22. This used to be `since` — the pitches after detection — compared
   * against a miss rate frozen on the row, which is a different measurement and a plausible one:
   * "has it got better since we found it". The guide asks for something else, and the board
   * prints the something else. First-five-versus-last-five spans the pattern's whole life, so a
   * rep who was already improving before anyone noticed gets credit for it, and a rate frozen at
   * detection cannot drift out of step with the strip beside it.
   */
  applicable: readonly GradedPitch[];
  /** ISO instant a manager started coaching, or null. Written by an event, never edited. */
  coachedAt: string | null;
  /** ISO instant of an explicit fixed event (a manager closing it by hand), or null. */
  fixedAt: string | null;
  /** Evaluation time, injected so the Stalled rule is testable rather than clock-dependent. */
  now: Date;
  /** Must match the predicate detection ran with. Opens a pattern; does not close one. */
  isMiss?: MissPredicate;
  /**
   * What COUNTS AS CLEAN — the fix rule's predicate, deliberately not the same one.
   *
   * Founder ruling 2026-09-22: Missed opens, Hit clears. Five Partials used to clear a pattern
   * because they are "not missed"; they are not "done right" either, and the card says the
   * second thing.
   */
  isClean?: CleanPredicate;
};

export type StatusVerdict = {
  status: PatternStatus;
  /**
   * C8, ruled 2026-09-22: open is anything not Fixed.
   *
   * Read this field. Do not write `status !== "fixed"` at a call site — that is a second copy of a
   * decision that already has an author, and the copy is the one nobody updates.
   */
  open: boolean;
  /** Why this status, in words a surface can show. A status with no reason is unarguable. */
  reason: string;
  /** Clean applicable pitches in a row, newest-first. Drives the "3 of 5 clean" progress. */
  streak: number;
};

const DAY_MS = 86_400_000;

/**
 * Resolve one pattern's status.
 *
 * ORDER IS THE DESIGN. Five states with overlapping conditions is how a resolver ends up both
 * Improving and Stalled, or neither, on the same inputs — so the branches are ordered most
 * conclusive first and each one returns:
 *
 *   fixed      an explicit close, or CLEAN_STREAK_TO_FIX clean applicable pitches in a row
 *   new        never coached (a rep can improve on their own; until a human engaged, the
 *              lifecycle has not started, and calling that "improving" would credit coaching
 *              that never happened)
 *   improving  coached, and missing it less often than when it was detected
 *   stalled    coached over a week ago, no streak, no improvement
 *   coaching   coached, being worked, not yet one of the above
 */
export function statusOf(input: StatusInput): StatusVerdict {
  const isMiss = input.isMiss ?? missedOnly;
  const isClean = input.isClean ?? doneRight;
  const ordered = [...input.applicable].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const streak = cleanStreak(ordered, isClean);

  if (input.fixedAt) {
    return { status: "fixed", open: false, reason: "Closed by a manager", streak };
  }
  if (streak >= CLEAN_STREAK_TO_FIX) {
    return {
      status: "fixed",
      open: false,
      reason: `${streak} clean pitches in a row`,
      streak,
    };
  }

  if (!input.coachedAt) {
    return {
      status: "new",
      open: true,
      reason: "Detected, not coached yet",
      streak,
    };
  }

  // THE GUIDE'S RULE, verbatim: "Miss rate in the last 5 applicable pitches is lower than the
  // first 5, and at least one clean pitch."
  //
  // Both halves matter. Without the rate test a rep who missed it five times and then four is
  // "improving"; without the clean-pitch test a rep who has never once done it right can be
  // improving on arithmetic alone, and a manager would be told to ease off someone who has not
  // yet landed it a single time.
  //
  // Only pitches that APPLIED count on either side — comparing against calendar pitches would
  // show improvement whenever the item simply stopped coming up.
  const first = ordered.slice(0, COMPARISON_WINDOW);
  const last = ordered.slice(-COMPARISON_WINDOW);
  const firstMisses = first.filter((p) => isMiss(p.grade)).length;
  const lastMisses = last.filter((p) => isMiss(p.grade)).length;
  const enoughToCompare = ordered.length >= COMPARISON_WINDOW * 2;
  const rateFell =
    first.length > 0 && last.length > 0 && lastMisses / last.length < firstMisses / first.length;
  // NOW LOAD-BEARING, and it was not two hours ago.
  //
  // Mutation S2 showed this term was dead: with one shared predicate, a fallen miss rate forces
  // at least one non-miss in `last`, so "and at least one clean pitch" could never change an
  // outcome. The survivor was a finding about the SPEC, not about the tests — the guide asks for
  // a condition its own other condition implies.
  //
  // The founder's 2026-09-22 ruling (Missed opens, Hit clears) separates the two predicates and
  // the term comes alive: five Partials are a fallen miss rate with NOTHING done right, and this
  // is the only line that catches it. A rep half-landing the point is not improving at it.
  const oneClean = last.some((p) => isClean(p.grade));

  if (enoughToCompare && rateFell && oneClean) {
    return {
      status: "improving",
      open: true,
      // The board's own words for it: "MISSES THEN → NOW  4/5 → 1/5 ▼".
      reason: `Misses ${firstMisses}/${first.length} → ${lastMisses}/${last.length}`,
      streak,
    };
  }

  // "Coached 7+ days ago, no clean streak, miss rate not improved" — all three, and the middle
  // one is easy to drop because a streak of 5 is already Fixed above. A streak of one to four is
  // not: that rep is landing it now, and telling their manager the coaching did not take would
  // send them into a 1:1 to fix something that is visibly moving.
  const coachedDaysAgo = (input.now.getTime() - Date.parse(input.coachedAt)) / DAY_MS;
  if (coachedDaysAgo >= STALLED_AFTER_DAYS && streak === 0) {
    const applicable = ordered.length;
    return {
      status: "stalled",
      open: true,
      // No applicable pitches since coaching is a DIFFERENT fact from coaching that did not take,
      // and a manager acts differently on each — one needs a pitch, the other needs a new approach.
      reason:
        applicable === 0
          ? `Coached ${Math.floor(coachedDaysAgo)} days ago, and it has not come up since`
          : `Coached ${Math.floor(coachedDaysAgo)} days ago with no improvement`,
      streak,
    };
  }

  return { status: "coaching", open: true, reason: "Being coached", streak };
}

/**
 * Count patterns for a chip or a header.
 *
 * Here rather than at each surface for the reason above: the moment two screens each write their
 * own `.filter(...)` over statuses, C8 is back. `openNotImproving` is the rep-progress list's
 * third number — C8 requires it be LABELLED as such and never called plain "open", because the
 * chip beside it counts Improving in.
 */
export function countPatterns(verdicts: readonly StatusVerdict[]) {
  return {
    open: verdicts.filter((v) => v.open).length,
    fixed: verdicts.filter((v) => v.status === "fixed").length,
    improving: verdicts.filter((v) => v.status === "improving").length,
    isNew: verdicts.filter((v) => v.status === "new").length,
    stalled: verdicts.filter((v) => v.status === "stalled").length,
    /** C8: the rep-progress list's third number. Label it "not yet improving", never "open". */
    openNotImproving: verdicts.filter((v) => v.open && v.status !== "improving").length,
  };
}
