import { describe, it, expect } from "vitest";
import { statusOf, COMPARISON_WINDOW } from "../status";
import { doneRight, missedOnly, type GradedPitch } from "../detect";
import type { Grade } from "../../pitchScore/rubric";

/**
 * A CONTROL, and it now proves the opposite of what it proved this morning.
 *
 * Mutation S2 — deleting the "and at least one clean pitch" term from the guide's Improving rule —
 * SURVIVED. The question a survivor always asks is: missing test, or equivalent mutant? The first
 * version of this file answered "equivalent", by exhaustion rather than by argument: with a single
 * shared predicate, both windows are COMPARISON_WINDOW long, so a fallen miss rate forces
 * `lastMisses < firstMisses <= 5` and therefore at least one non-miss in the later window. No test
 * could catch the term's removal, because the term could never change an outcome.
 *
 * That was true, and it was a finding about the SPECIFICATION: the guide asks for a condition its
 * own other condition implies. Which is the sort of thing worth showing someone rather than
 * filing.
 *
 * The founder's 2026-09-22 ruling — Missed opens, Hit clears — separates the predicates, and the
 * implication breaks. Five Partials are a fallen miss rate with nothing done right. The term is
 * now the only line standing between that and a rep being told they are improving at something
 * they have never once landed.
 *
 * So this file keeps its job and changes its claim: it pins the case that makes the term
 * load-bearing, and it pins WHY the old redundancy existed, so that reverting the predicates
 * cannot quietly re-kill the rule.
 */

const NOW = new Date("2026-03-20T10:00:00Z");
const p = (day: number, grade: Grade): GradedPitch => ({
  pitchId: `p${day}`,
  recordedAt: `2026-03-${String(day).padStart(2, "0")}T10:00:00Z`,
  grade,
  points: grade === "hit" ? 4 : grade === "partial" ? 2 : 0,
});
const run = (grades: Grade[]) => grades.map((g, i) => p(i + 1, g));
const base = { coachedAt: "2026-03-10T10:00:00Z", fixedAt: null, now: NOW };

describe("the at-least-one-clean term is load-bearing under the split predicates", () => {
  it("refuses 'improving' when the miss rate fell but nothing was done right", () => {
    // 5/5 → 0/5. By the rate test alone this is the best improvement the rule can score.
    const fellToNothing = run(["missed", "missed", "missed", "missed", "missed",
                               "partial", "partial", "partial", "partial", "partial"]);
    const v = statusOf({ ...base, applicable: fellToNothing });
    expect(v.status).not.toBe("improving");
    // And it is not a data problem either — there is plenty of evidence, it just is not progress.
    expect(v.open).toBe(true);
  });

  it("allows it the moment one pitch actually lands", () => {
    const oneLanded = run(["missed", "missed", "missed", "missed", "missed",
                           "partial", "partial", "partial", "partial", "hit"]);
    expect(statusOf({ ...base, applicable: oneLanded }).status).toBe("improving");
  });

  it("the difference is ONE grade, which is what makes the term worth a line of code", () => {
    const partial = run(["missed", "missed", "missed", "missed", "missed",
                         "partial", "partial", "partial", "partial", "partial"]);
    const hit = run(["missed", "missed", "missed", "missed", "missed",
                     "partial", "partial", "partial", "partial", "hit"]);
    expect(statusOf({ ...base, applicable: partial }).status).not.toBe(
      statusOf({ ...base, applicable: hit }).status
    );
  });
});

describe("why it USED to be redundant, pinned so a revert cannot re-kill it silently", () => {
  it("under one shared predicate, a fallen rate implies a non-miss in the later window", () => {
    // The original exhaustion argument, kept. If someone ever passes the same predicate for both
    // — `isClean: (g) => !missedOnly(g)` — the term goes dead again, and this states exactly why.
    let checked = 0;
    for (let firstMisses = 0; firstMisses <= COMPARISON_WINDOW; firstMisses++) {
      for (let lastMisses = 0; lastMisses <= COMPARISON_WINDOW; lastMisses++) {
        const rateFell = lastMisses / COMPARISON_WINDOW < firstMisses / COMPARISON_WINDOW;
        if (rateFell) expect(lastMisses === COMPARISON_WINDOW).toBe(false);
        checked++;
      }
    }
    expect(checked).toBe((COMPARISON_WINDOW + 1) ** 2);
  });

  it("and the two predicates genuinely disagree, which is the whole basis of the ruling", () => {
    expect(missedOnly("partial")).toBe(false); // not a miss — does not open a pattern
    expect(doneRight("partial")).toBe(false); // not done right — does not close one
    // A grade that is neither. That gap is where five Partials used to slip through.
    expect(missedOnly("hit")).toBe(false);
    expect(doneRight("hit")).toBe(true);
  });
});
