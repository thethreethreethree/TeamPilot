import { describe, it, expect } from "vitest";
import { parseHuddleCue } from "../parseHuddleCue";

/**
 * parseHuddleCue pins the shared parse to the HUDDLE vocabulary. These tests cover the huddle-specific bits;
 * the shared parse's malformed-input handling is exercised in full by the meeting suite (same parseCueDecision).
 */
describe("parseHuddleCue", () => {
  it("returns a cue for a valid huddle trigger", () => {
    const d = parseHuddleCue(
      JSON.stringify({
        phase: "status_round",
        trigger: "vague_status",
        shouldCue: true,
        importance: "medium",
        cue: "'Almost done' — what's left, and by when?",
      })
    );
    expect(d.shouldCue).toBe(true);
    expect(d.trigger).toBe("vague_status");
    expect(d.cue).toBe("'Almost done' — what's left, and by when?");
  });

  it("accepts overrun/deep_dive (the main huddle catch)", () => {
    const d = parseHuddleCue(
      JSON.stringify({ phase: "deep_dive", trigger: "overrun", shouldCue: true, importance: "high", cue: "Take it offline." })
    );
    expect(d.phase).toBe("deep_dive");
    expect(d.trigger).toBe("overrun");
    expect(d.importance).toBe("high");
  });

  it("normalizes a leaked MEETING trigger to none (huddle vocab is the gate)", () => {
    // 'undecided' is a MEETING trigger, not a huddle one — it must not masquerade as a valid huddle cue.
    const d = parseHuddleCue(
      JSON.stringify({ phase: "discussion", trigger: "undecided", shouldCue: true, cue: "Close the decision." })
    );
    expect(d.trigger).toBe("none");
    expect(d.phase).toBe("unknown"); // 'discussion' is meeting vocab too
  });

  it("stays silent on a malformed response", () => {
    expect(parseHuddleCue("garbage").shouldCue).toBe(false);
    expect(parseHuddleCue(JSON.stringify({ trigger: "overrun", shouldCue: true, cue: "" })).shouldCue).toBe(false);
  });

  it("honors force for an on-demand ask", () => {
    const d = parseHuddleCue(
      JSON.stringify({ phase: "status_round", trigger: "none", shouldCue: false, cue: "Looks tight — keep going." }),
      { force: true }
    );
    expect(d.shouldCue).toBe(true);
    expect(d.cue).toBe("Looks tight — keep going.");
  });
});
