import { describe, it, expect } from "vitest";
import { isProblemOpen, OPEN_PROBLEM_STATUSES } from "../problems";

/**
 * Locks the open/closed classification behind the §3.5 moat metric (resolution
 * rate). isProblemOpen decides whether a problem counts as "still in play" vs
 * "resolved/dismissed"; if a resolved/dismissed status ever leaked into the OPEN
 * set, the resolution-rate differentiator would be silently undercounted — the
 * exact §3.4 "confident, well-formed failure" the constitution exists to defeat.
 * These cases pin the boundary so a future status rename can't quietly move it.
 */
describe("isProblemOpen — §3.5 open/closed boundary", () => {
  it("the three in-play statuses are OPEN", () => {
    expect(isProblemOpen("draft")).toBe(true);
    expect(isProblemOpen("surfaceable")).toBe(true);
    expect(isProblemOpen("surfaced")).toBe(true);
  });

  it("resolved and dismissed are NOT open (the load-bearing metric invariant)", () => {
    expect(isProblemOpen("resolved")).toBe(false);
    expect(isProblemOpen("dismissed")).toBe(false);
  });

  it("an unknown / garbage status is NOT open (defensive default — never count noise as in-play)", () => {
    expect(isProblemOpen("")).toBe(false);
    expect(isProblemOpen("archived")).toBe(false);
    expect(isProblemOpen("OPEN")).toBe(false); // case-sensitive by design
    expect(isProblemOpen("closed")).toBe(false);
  });

  it("OPEN_PROBLEM_STATUSES is exactly the in-play set (no resolved/dismissed member)", () => {
    expect([...OPEN_PROBLEM_STATUSES].sort()).toEqual(
      ["draft", "surfaceable", "surfaced"].sort()
    );
    expect(OPEN_PROBLEM_STATUSES).not.toContain("resolved");
    expect(OPEN_PROBLEM_STATUSES).not.toContain("dismissed");
  });
});
