import { describe, it, expect } from "vitest";
import { parseMeetingCue } from "../parseMeetingCue";

/**
 * parseMeetingCue is the Meeting brain's output contract. It must be TOTAL and silent-safe: any malformed,
 * unparseable, or out-of-vocabulary model response resolves to "stay silent" (§5 bad-parse-fails-safe; §3.4
 * never fabricate), and the understanding gate holds (an empty cue is not a cue). Mirrors the sales
 * generateLiveCue parse it was modeled on.
 */
describe("parseMeetingCue — valid responses", () => {
  it("returns a cue when shouldCue is true and the cue is non-empty", () => {
    const d = parseMeetingCue(
      JSON.stringify({
        phase: "decision_point",
        trigger: "undecided",
        shouldCue: true,
        importance: "high",
        cue: "No decision was made on the launch date — close it before moving on.",
      })
    );
    expect(d).toEqual({
      shouldCue: true,
      cue: "No decision was made on the launch date — close it before moving on.",
      trigger: "undecided",
      phase: "decision_point",
      importance: "high",
    });
  });

  it("accepts the imbalance trigger (the speaker-label-dependent one)", () => {
    const d = parseMeetingCue(
      JSON.stringify({ phase: "discussion", trigger: "imbalance", shouldCue: true, cue: "Bring Dana in — she's been quiet." })
    );
    expect(d.shouldCue).toBe(true);
    expect(d.trigger).toBe("imbalance");
    expect(d.importance).toBe("medium"); // defaulted (omitted by the model)
  });
});

describe("parseMeetingCue — the understanding gate (silent unless a real cue)", () => {
  it("stays silent when shouldCue is false, but keeps the read (phase/trigger)", () => {
    const d = parseMeetingCue(
      JSON.stringify({ phase: "discussion", trigger: "none", shouldCue: false, cue: "" })
    );
    expect(d).toEqual({ shouldCue: false, cue: null, trigger: "none", phase: "discussion", importance: "low" });
  });

  it("stays silent when shouldCue is true but the cue is empty (an empty cue is not a cue)", () => {
    const d = parseMeetingCue(JSON.stringify({ phase: "drift", trigger: "drift", shouldCue: true, cue: "   " }));
    expect(d.shouldCue).toBe(false);
    expect(d.cue).toBeNull();
    expect(d.phase).toBe("drift"); // the read is preserved even when silent
  });
});

describe("parseMeetingCue — malformed / adversarial output fails silent-safe", () => {
  it("returns silent on non-JSON", () => {
    expect(parseMeetingCue("not json at all")).toEqual({
      shouldCue: false,
      cue: null,
      trigger: "none",
      phase: "unknown",
      importance: "low",
    });
  });

  it("returns silent on a JSON non-object (array / string / null)", () => {
    expect(parseMeetingCue("[1,2,3]").shouldCue).toBe(false);
    expect(parseMeetingCue('"a string"').shouldCue).toBe(false);
    expect(parseMeetingCue("null").shouldCue).toBe(false);
  });

  it("normalizes an out-of-vocabulary phase/trigger to unknown/none (e.g. a leaked sales trigger)", () => {
    const d = parseMeetingCue(
      JSON.stringify({ phase: "close", trigger: "objection", shouldCue: true, cue: "Close them now!" })
    );
    // 'close'/'objection' are SALES vocab — not in the meeting sets — so they normalize away; the cue text
    // survives the parse, but the trigger/phase are neutralized (a leaked sales cue can't masquerade as a
    // valid meeting trigger).
    expect(d.phase).toBe("unknown");
    expect(d.trigger).toBe("none");
  });

  it("defaults a malformed importance to medium, never a parser-accident low", () => {
    const d = parseMeetingCue(
      JSON.stringify({ phase: "wrap", trigger: "summarize", shouldCue: true, importance: 42, cue: "Recap decisions + owners." })
    );
    expect(d.importance).toBe("medium");
  });
});

describe("parseMeetingCue — force (facilitator asked)", () => {
  it("honors any non-empty cue when forced, even without shouldCue", () => {
    const d = parseMeetingCue(
      JSON.stringify({ phase: "discussion", trigger: "none", shouldCue: false, cue: "Nothing urgent — let them keep going." }),
      { force: true }
    );
    expect(d.shouldCue).toBe(true);
    expect(d.cue).toBe("Nothing urgent — let them keep going.");
  });

  it("still stays silent when forced but the cue is empty", () => {
    const d = parseMeetingCue(JSON.stringify({ phase: "opening", trigger: "none", shouldCue: true, cue: "" }), {
      force: true,
    });
    expect(d.shouldCue).toBe(false);
  });
});
