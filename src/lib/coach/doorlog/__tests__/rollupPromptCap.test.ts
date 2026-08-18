import { describe, it, expect } from "vitest";
import { buildRollupUserMessage, ROLLUP_MAX_DETAIL_PITCHES, type PitchSignal } from "../rollup";

/**
 * Guard for the rollup prompt cap (audit 2026-08-19). Folding all 500 sampled pitches into the prompt starved
 * the reasoning model → an empty rollup that never persisted + a paid LLM call re-burned on every new pitch.
 * The per-pitch DETAIL is now bounded to the most-recent ROLLUP_MAX_DETAIL_PITCHES, while the outcome
 * distribution still reflects every pitch. This locks both halves so the starvation can't silently return.
 */

function pitches(n: number): PitchSignal[] {
  return Array.from({ length: n }, (_, i) => ({
    outcome: i % 3 === 0 ? "sold" : "not_interested",
    summary: `pitch ${i} summary`,
    strengths: ["s"],
    improvements: ["i"],
    scores: { rapport: 50 },
  }));
}

const detailBlocks = (msg: string) => (msg.match(/Pitch \d+ \[outcome:/g) ?? []).length;

describe("rollup prompt cap — a prolific rep can't starve the model", () => {
  it("caps the per-pitch detail block at ROLLUP_MAX_DETAIL_PITCHES even with 200 pitches", () => {
    const msg = buildRollupUserMessage({ pitches: pitches(200), outcomeCounts: { sold: 67, not_interested: 133 }, previousHeadline: null });
    expect(detailBlocks(msg)).toBe(ROLLUP_MAX_DETAIL_PITCHES);
    // The full distribution is still present (the aggregate signal is not truncated).
    expect(msg).toContain("sold: 67");
    expect(msg).toContain("not_interested: 133");
    // And the model is told the detail is a recent sample, not the whole set.
    expect(msg).toContain("most recent pitches in detail");
  });

  it("does not truncate or add the sample note when the rep is under the cap", () => {
    const msg = buildRollupUserMessage({ pitches: pitches(5), outcomeCounts: { sold: 2, not_interested: 3 }, previousHeadline: null });
    expect(detailBlocks(msg)).toBe(5);
    expect(msg).not.toContain("most recent pitches in detail");
  });
});
