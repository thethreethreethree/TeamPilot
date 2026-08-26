import { describe, it, expect } from "vitest";
import { parseTeamBrief } from "../teamTrainingBrief";
import { buildTeamBriefUserMessage } from "../teamTrainingBriefPrompt";

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

/**
 * F1 regression guard (review 2026-08-26): the engine whitelists repFocus against the reps' REAL names, so the prompt
 * MUST carry those real names (+ each rep's own growth) — otherwise the model has nothing to attribute a focus to and
 * every name it invents is filtered out, making "one focus each" permanently empty. Lock the name into the prompt.
 */
describe("buildTeamBriefUserMessage — carries per-rep names into the prompt (F1)", () => {
  it("includes each repSignal's real name and their top focus", () => {
    const msg = buildTeamBriefUserMessage({
      periodLabel: "the last 7 days",
      repCount: 2,
      dissectCount: 6,
      growthAreas: ["discovery"],
      strategies: [],
      strengths: [],
      repSignals: [
        { rep: "Anthony", topFocus: "Ask before pitching" },
        { rep: "Humza", topFocus: "Slow the close" },
      ],
      door: { doorsKnocked: 10, presentations: 6, sold: 2 },
    });
    expect(msg).toContain("Anthony");
    expect(msg).toContain("Humza");
    expect(msg).toContain("Ask before pitching");
    expect(msg).toMatch(/PER-REP SIGNAL/);
  });

  it("degrades honestly when there is no per-rep signal (omit repFocus, no fabricated names)", () => {
    const msg = buildTeamBriefUserMessage({
      periodLabel: "the last 7 days",
      repCount: 0,
      dissectCount: 4,
      growthAreas: ["discovery"],
      strategies: [],
      strengths: [],
      repSignals: [],
      door: { doorsKnocked: 0, presentations: 0, sold: 0 },
    });
    expect(msg).toMatch(/omit repFocus/i);
  });
});
