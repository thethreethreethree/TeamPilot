import { describe, it, expect } from "vitest";
import { parseTeamBrief } from "../teamTrainingBrief";

/**
 * parseTeamBrief shape-guards the Team Training Brief LLM output. Honesty properties that matter (§3.4 / §A18):
 *  - it NEVER surfaces a repFocus for a rep the engine didn't include (an LLM hallucinating a name → dropped);
 *  - a brief with neither a theme nor a drill carries no teachable signal → null (don't render an empty shell);
 *  - malformed JSON → null (never a fabricated brief); a ```json fence is tolerated.
 */

const REPS = ["Anthony", "Humza"];
const LABEL = "the last 7 days";

describe("parseTeamBrief", () => {
  it("parses a valid brief and keeps only reps the engine included", () => {
    const text = JSON.stringify({
      themes: [{ title: "Slow down the open", why: "Reps pitch before discovery" }],
      drill: { title: "30-second discovery drill", steps: ["Pair up", "Ask 3 questions before pitching"] },
      repFocus: [
        { rep: "Anthony", focus: "Ask one more question before the pitch" },
        { rep: "Ghost", focus: "not on the team" }, // must be dropped — not in REPS
      ],
    });
    const b = parseTeamBrief(text, LABEL, REPS);
    expect(b).not.toBeNull();
    expect(b!.themes[0]?.title).toBe("Slow down the open");
    expect(b!.drill.steps).toHaveLength(2);
    expect(b!.repFocus.map((r) => r.rep)).toEqual(["Anthony"]); // Ghost dropped
    expect(b!.periodLabel).toBe(LABEL);
  });

  it("tolerates a ```json fence", () => {
    const text = "```json\n" + JSON.stringify({ themes: [{ title: "T", why: "W" }], drill: { title: "", steps: [] }, repFocus: [] }) + "\n```";
    expect(parseTeamBrief(text, LABEL, REPS)?.themes[0]?.title).toBe("T");
  });

  it("returns null when there is neither a theme nor a drill (no teachable signal)", () => {
    const text = JSON.stringify({ themes: [], drill: { title: "", steps: [] }, repFocus: [{ rep: "Anthony", focus: "x" }] });
    expect(parseTeamBrief(text, LABEL, REPS)).toBeNull();
  });

  it("returns null on malformed JSON (never a fabricated brief)", () => {
    expect(parseTeamBrief("not json at all", LABEL, REPS)).toBeNull();
    expect(parseTeamBrief("", LABEL, REPS)).toBeNull();
  });

  it("caps themes at 3 and drill steps at 6", () => {
    const text = JSON.stringify({
      themes: Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, why: "w" })),
      drill: { title: "D", steps: Array.from({ length: 9 }, (_, i) => `s${i}`) },
      repFocus: [],
    });
    const b = parseTeamBrief(text, LABEL, REPS)!;
    expect(b.themes).toHaveLength(3);
    expect(b.drill.steps).toHaveLength(6);
  });
});
