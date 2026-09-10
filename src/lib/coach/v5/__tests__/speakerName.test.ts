import { describe, it, expect } from "vitest";
import { speakerName, isUnattributed } from "../speakerName";

/**
 * speakerName — the session page used to print the raw database column, so a recovered
 * transcript read `UNKNOWN` above every line. `unknown` is an honest internal state; printed
 * at a rep it reads as a verdict on their call, or as an error.
 */

describe("speakerName", () => {
  it("never prints an INTERNAL state word at a rep", () => {
    /*
      My first version of this asserted the output never equals the column value, which is
      false and rightly failed: "customer" is a perfectly good English word and "Customer"
      is the correct label for it. The real property is narrower — the values that mean
      something only inside the system must never reach the screen.
    */
    for (const internal of ["unknown", "", "speaker_0", "speaker_1", "AGENT"]) {
      expect(speakerName(internal)).toBe("Unattributed");
    }
  });

  it("calls an unattributed line Unattributed, not UNKNOWN", () => {
    expect(speakerName("unknown")).toBe("Unattributed");
  });

  it("says Rep rather than You, because this page does not know who is looking", () => {
    // A manager can open a rep's call. "You" would be a claim the page cannot support, and
    // telling a manager the rep's words are theirs is worse than two nouns differing.
    expect(speakerName("agent")).toBe("Rep");
    expect(speakerName("customer")).toBe("Customer");
  });

  it("falls to Unattributed for anything it does not recognise", () => {
    // A speaker value this code has not met is exactly the case where printing the column
    // would leak a new internal state onto a rep's screen — which is how UNKNOWN got there.
    expect(speakerName("speaker_0")).toBe("Unattributed");
    expect(speakerName("")).toBe("Unattributed");
    expect(speakerName(null)).toBe("Unattributed");
    expect(speakerName(undefined)).toBe("Unattributed");
  });
});

describe("isUnattributed", () => {
  it("is true only when nobody has said whose voice it is", () => {
    expect(isUnattributed("unknown")).toBe(true);
    expect(isUnattributed(null)).toBe(true);
    expect(isUnattributed("speaker_1")).toBe(true);
  });

  it("is false for a real attribution", () => {
    expect(isUnattributed("agent")).toBe(false);
    expect(isUnattributed("customer")).toBe(false);
  });
});
