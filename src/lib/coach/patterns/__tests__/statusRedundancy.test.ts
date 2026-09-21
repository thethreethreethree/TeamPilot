import { describe, it, expect } from "vitest";
import { COMPARISON_WINDOW } from "../status";
import { missedOnly } from "../detect";
import type { Grade } from "../../pitchScore/rubric";

/**
 * A CONTROL, not a feature test.
 *
 * Mutation S2 — deleting the "and at least one clean pitch" term from the Improving rule —
 * survived. The question a survivor always asks is: missing test, or equivalent mutant? This
 * file answers it by exhaustion rather than by argument, because "I convinced myself it is
 * equivalent" is how a real gap gets filed as a non-finding.
 *
 * The claim: with both comparison windows fixed at COMPARISON_WINDOW, a fallen miss rate ALREADY
 * implies at least one non-miss in the later window. So the guide's second condition cannot
 * change an outcome, and no test could catch its removal.
 */
describe("the at-least-one-clean term is implied, not untested", () => {
  const GRADES: Grade[] = ["hit", "partial", "missed"];

  it("holds for every possible pair of windows", () => {
    // Every combination of miss-counts in the two windows, which is all the rule can see.
    let checked = 0;
    for (let firstMisses = 0; firstMisses <= COMPARISON_WINDOW; firstMisses++) {
      for (let lastMisses = 0; lastMisses <= COMPARISON_WINDOW; lastMisses++) {
        const rateFell = lastMisses / COMPARISON_WINDOW < firstMisses / COMPARISON_WINDOW;
        const canBeAllMisses = lastMisses === COMPARISON_WINDOW;
        // The implication: whenever the rate fell, the later window cannot be all misses.
        if (rateFell) expect(canBeAllMisses).toBe(false);
        checked++;
      }
    }
    expect(checked).toBe((COMPARISON_WINDOW + 1) ** 2);
  });

  it("and the redundancy depends ENTIRELY on 'clean' meaning 'not missed'", () => {
    // If clean meant "done right" (a hit), five Partials would be a fallen rate with nothing
    // done right — the case that would make the term bite. Recorded so the day someone changes
    // that reading, this control fails and points at the rule rather than at a mystery.
    const fivePartials: Grade[] = Array(COMPARISON_WINDOW).fill("partial");
    expect(fivePartials.every((g) => !missedOnly(g))).toBe(true); // "clean" today
    expect(fivePartials.some((g) => g === "hit")).toBe(false); // but nothing done right
    expect(GRADES).toContain("partial");
  });
});
