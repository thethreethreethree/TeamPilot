import { describe, expect, it } from "vitest";
import {
  detectNvcEvaluation,
  detectBareAssertion,
  detectIdentityCollision,
  detectAll,
} from "../heuristics";

/**
 * Heuristic calibration tests.
 *
 * Per A4 (don't pre-resolve uncertainties; defer to §4 evidence), the
 * "is regex sharp enough?" question is part of the readout, not a
 * pre-decision. These tests pin DOWN the current behavior — they
 * don't claim it's correct. When the §4 readout shows a heuristic
 * mis-firing or under-firing, the failing test pattern becomes the
 * input to a revision PR.
 *
 * Each detector has three categories:
 *   - Positives we expect to fire on (true positives).
 *   - Negatives we expect NOT to fire on (true negatives — phrases
 *     that look similar but shouldn't trigger).
 *   - Edge cases — recorded explicitly so they're considered in any
 *     future calibration change.
 */

describe("detectNvcEvaluation", () => {
  it("fires on absolute language", () => {
    expect(detectNvcEvaluation("you always do this")).not.toBeNull();
    expect(detectNvcEvaluation("we never ship on time")).not.toBeNull();
  });

  it("fires on diagnostic-as-fact phrasing", () => {
    expect(detectNvcEvaluation("this is broken")).not.toBeNull();
    expect(detectNvcEvaluation("that is wrong")).not.toBeNull();
  });

  it("fires on assertive 'obviously' / 'clearly'", () => {
    expect(detectNvcEvaluation("Obviously, we should fix this")).not.toBeNull();
    expect(detectNvcEvaluation("Clearly the right call")).not.toBeNull();
  });

  it("fires on mind-reading phrasing", () => {
    expect(detectNvcEvaluation("they don't get it")).not.toBeNull();
    expect(
      detectNvcEvaluation("you never listen to feedback")
    ).not.toBeNull();
  });

  it("does NOT fire on observable language", () => {
    expect(
      detectNvcEvaluation("the deploy failed at 3pm; here's the log")
    ).toBeNull();
    expect(
      detectNvcEvaluation("I noticed three retries in a row")
    ).toBeNull();
    expect(detectNvcEvaluation("the test returned 500")).toBeNull();
  });
});

describe("detectBareAssertion", () => {
  it("fires on direct prescription at start", () => {
    expect(detectBareAssertion("We should ship this today")).not.toBeNull();
    expect(detectBareAssertion("Let's just revert it")).not.toBeNull();
    expect(detectBareAssertion("The answer is to scale up")).not.toBeNull();
  });

  it("fires on 'I think we should…' shape", () => {
    expect(
      detectBareAssertion("I think we should bump the timeout")
    ).not.toBeNull();
    expect(
      detectBareAssertion("I believe you need to back this out")
    ).not.toBeNull();
  });

  it("does NOT fire when a label/question precedes", () => {
    // The "should" is mid-sentence after a label, not a bare opener.
    expect(
      detectBareAssertion(
        "It sounds like you're saying the timeout is too tight — we should bump it?"
      )
    ).toBeNull();
    expect(
      detectBareAssertion("What I'm noticing is the retry pattern looks off.")
    ).toBeNull();
  });
});

describe("detectIdentityCollision", () => {
  it("fires on person-as-trait phrasing", () => {
    expect(detectIdentityCollision("they're incompetent")).not.toBeNull();
    expect(detectIdentityCollision("he is lazy")).not.toBeNull();
    expect(detectIdentityCollision("you're clueless")).not.toBeNull();
    expect(
      detectIdentityCollision("that person is out of their depth")
    ).not.toBeNull();
  });

  it("fires on trust / belonging attacks", () => {
    expect(detectIdentityCollision("they can't be trusted")).not.toBeNull();
    expect(
      detectIdentityCollision("she shouldn't be here")
    ).not.toBeNull();
  });

  it("does NOT fire on behavior-as-fact", () => {
    expect(
      detectIdentityCollision("the deploy script she ran missed the migrate step")
    ).toBeNull();
    expect(
      detectIdentityCollision("his last three PRs landed without tests")
    ).toBeNull();
  });
});

describe("detectAll priority", () => {
  it("orders identity above evaluation above assertion", () => {
    // Message contains both an identity collision and an absolute.
    const out = detectAll(
      "you're incompetent and you always miss the standup"
    );
    expect(out[0]?.id).toBe("stone-identity-collision");
    expect(out[1]?.id).toBe("nvc-evaluation");
  });

  it("ignores trivially short drafts", () => {
    expect(detectAll("ok")).toEqual([]);
    expect(detectAll("")).toEqual([]);
  });

  it("returns empty for observable, well-labelled messages", () => {
    expect(
      detectAll(
        "It sounds like the deploy hit a retry storm at 3pm. Here is the log line."
      )
    ).toEqual([]);
  });
});
