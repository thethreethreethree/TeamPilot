import { describe, expect, it } from "vitest";
import { parseGraded, computeQuestionRate } from "../salesScore";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

const cat = (over: Record<string, unknown> = {}) => ({
  key: "opener",
  score: 7,
  rationale: "strong, warm open",
  ...over,
});

/**
 * parseGraded is the §3.5 / A11 measurement guard: scores are clamped to [0,10],
 * only known categories count, and a score with no rationale is dropped (a
 * number the rep can't inspect is a naked verdict).
 */
describe("parseGraded — measurement honesty", () => {
  it("keeps a well-formed, rationale-backed score", () => {
    const out = parseGraded(JSON.stringify({ categories: [cat()] }));
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe("opener");
    expect(out[0]!.score).toBe(7);
    expect(out[0]!.display).toBe("7/10");
  });

  it("A11: DROPS a score with no rationale (never a naked verdict)", () => {
    const out = parseGraded(
      JSON.stringify({
        categories: [cat({ key: "tone", rationale: "" }), cat({ key: "close" })],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe("close");
  });

  it("clamps scores to [0,10] and rounds", () => {
    const out = parseGraded(
      JSON.stringify({
        categories: [
          cat({ key: "opener", score: 15 }),
          cat({ key: "objection", score: -4 }),
          cat({ key: "tone", score: 7.6 }),
        ],
      })
    );
    const byKey = Object.fromEntries(out.map((c) => [c.key, c.score]));
    expect(byKey.opener).toBe(10);
    expect(byKey.objection).toBe(0);
    expect(byKey.tone).toBe(8);
  });

  it("drops an unknown category key", () => {
    const out = parseGraded(
      JSON.stringify({ categories: [cat({ key: "vibes" }), cat({ key: "close" })] })
    );
    expect(out.map((c) => c.key)).toEqual(["close"]);
  });

  it("drops a non-numeric score", () => {
    const out = parseGraded(
      JSON.stringify({ categories: [cat({ key: "opener", score: "high" })] })
    );
    expect(out).toHaveLength(0);
  });

  it("hasSignal:false or malformed → empty list", () => {
    expect(parseGraded(JSON.stringify({ hasSignal: false, categories: [cat()] }))).toEqual([]);
    expect(parseGraded("not json")).toEqual([]);
  });

  it("accepts the new graded category next_step (founder 2026-07-07)", () => {
    const out = parseGraded(
      JSON.stringify({ categories: [cat({ key: "next_step", score: 3 })] })
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe("next_step");
    expect(out[0]!.display).toBe("3/10");
  });
});

const seg = (
  seq: number,
  speaker: TranscriptSegment["speaker"],
  text: string
): TranscriptSegment =>
  ({ id: `s${seq}`, sessionId: "x", speaker, text, seq, spokenAt: null }) as TranscriptSegment;

/**
 * computeQuestionRate is deterministic (like talk_ratio) — a COUNT surfaced as an
 * observation (§A11), not an LLM grade. These pin the counting + honest empties.
 */
describe("computeQuestionRate — deterministic question share", () => {
  it("counts rep turns that ask a question", () => {
    const r = computeQuestionRate([
      seg(0, "agent", "How long have you had this internet?"),
      seg(1, "customer", "About two years."),
      seg(2, "agent", "Got it, that makes sense."),
      seg(3, "agent", "Would you want faster speed for the same price?"),
    ]);
    // 2 of 3 rep turns are questions.
    expect(r?.key).toBe("question_rate");
    expect(r?.display).toBe("2 of 3");
    expect(r?.computed).toBe(true);
    expect(r?.citation).toBeNull();
  });

  it("detects unpunctuated interrogatives", () => {
    const r = computeQuestionRate([
      seg(0, "agent", "what are you paying now"),
      seg(1, "agent", "the weather is nice"),
    ]);
    expect(r?.display).toBe("1 of 2");
  });

  it("returns null when the rep never spoke", () => {
    expect(computeQuestionRate([seg(0, "customer", "Not interested.")])).toBeNull();
  });
});
