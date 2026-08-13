import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Drift guard for the v5 engines' agent-turn threshold.
 *
 * `MIN_AGENT_SEGMENTS` is defined SEPARATELY (not shared) in salesReview, salesScore, salesDissect, and
 * salesWhy — each gates "does this engine run, or short-circuit to EMPTY" on `agentSegments < MIN_AGENT_SEGMENTS`.
 *
 * The 2026-08-13 after-pitch heal fix (`afterPitchHeal.ts`, commit c7921692) relies on an EXACT equivalence:
 * "scores present ⟺ the review engine would run" — which holds ONLY while salesScore's and salesReview's
 * thresholds are equal. If one drifts (e.g. someone bumps salesScore to 2), a session with 1 agent turn would
 * produce a review (narrative) but NO scores, silently breaking the heal's convergence gate. These are private
 * `const`s (not exported), so this guard reads the source and asserts the values agree — the same shape as the
 * curated-voice sync guard. A drift fails CI instead of silently corrupting the heal.
 */
const V5_DIR = join(__dirname, "..");
const ENGINES = ["salesReview.ts", "salesScore.ts", "salesDissect.ts", "salesWhy.ts"];

function readMinAgentSegments(file: string): number {
  const src = readFileSync(join(V5_DIR, file), "utf8");
  const m = src.match(/const\s+MIN_AGENT_SEGMENTS\s*=\s*(\d+)/);
  if (!m) throw new Error(`MIN_AGENT_SEGMENTS not found in ${file}`);
  return Number(m[1]);
}

describe("MIN_AGENT_SEGMENTS stays in lockstep across the v5 engines", () => {
  const values = Object.fromEntries(ENGINES.map((f) => [f, readMinAgentSegments(f)]));

  it("every engine defines MIN_AGENT_SEGMENTS", () => {
    for (const f of ENGINES) expect(Number.isInteger(values[f])).toBe(true);
  });

  it("salesScore and salesReview agree (the after-pitch heal's load-bearing reliance)", () => {
    // If these two ever diverge, afterPitchNeedsHeal's "scores present ⟺ review would run" proxy breaks.
    expect(values["salesScore.ts"]).toBe(values["salesReview.ts"]);
  });

  it("all v5 engines share one threshold", () => {
    const distinct = new Set(Object.values(values));
    expect(distinct.size, `engines disagree on MIN_AGENT_SEGMENTS: ${JSON.stringify(values)}`).toBe(1);
  });
});
