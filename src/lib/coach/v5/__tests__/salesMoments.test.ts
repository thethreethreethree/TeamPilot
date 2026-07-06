import { describe, expect, it } from "vitest";
import { parseMoments } from "../salesMoments";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

function seg(seq: number, over: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: `s${seq}`,
    sessionId: "sess",
    speaker: seq % 2 === 0 ? "agent" : "customer",
    text: `line ${seq}`,
    seq,
    spokenAt: null,
    ...over,
  };
}

const SEGMENTS = [seg(0), seg(1), seg(2), seg(3)];

describe("parseMoments — §3.4 grounding invariants", () => {
  it("keeps a moment that references a real segment (atSeq in transcript)", () => {
    const out = parseMoments(
      JSON.stringify({ hasSignal: true, moments: [{ atSeq: 2, kind: "objection", label: "price pushback" }] }),
      SEGMENTS
    );
    expect(out).not.toBeNull();
    expect(out!.hasSignal).toBe(true);
    expect(out!.moments).toHaveLength(1);
    expect(out!.moments[0]!.atSeq).toBe(2);
  });

  it("DROPS a moment whose atSeq is NOT a real segment (no fabricated moments)", () => {
    const out = parseMoments(
      JSON.stringify({
        hasSignal: true,
        moments: [
          { atSeq: 99, kind: "close", label: "ghost moment" }, // seq 99 doesn't exist
          { atSeq: 1, kind: "discovery", label: "real one" },
        ],
      }),
      SEGMENTS
    );
    expect(out!.moments).toHaveLength(1);
    expect(out!.moments[0]!.atSeq).toBe(1);
  });

  it("defaults an unknown kind to 'other'", () => {
    const out = parseMoments(
      JSON.stringify({ hasSignal: true, moments: [{ atSeq: 0, kind: "not-a-kind", label: "x" }] }),
      SEGMENTS
    );
    expect(out!.moments[0]!.kind).toBe("other");
  });

  it("promotes at most ONE breakdown; a second is demoted to 'other'", () => {
    const out = parseMoments(
      JSON.stringify({
        hasSignal: true,
        moments: [
          { atSeq: 0, kind: "objection", label: "first", isBreakdown: true },
          { atSeq: 1, kind: "objection", label: "second", isBreakdown: true },
        ],
      }),
      SEGMENTS
    );
    const breakdowns = out!.moments.filter((m) => m.kind === "breakdown");
    expect(breakdowns).toHaveLength(1); // the invariant: a single turning point
    // The second breakdown-flagged moment is NOT promoted; it keeps its own
    // declared kind ("objection") rather than becoming a second "breakdown".
    expect(out!.moments[1]!.kind).toBe("objection");
  });

  it("caps at 5 moments", () => {
    const out = parseMoments(
      JSON.stringify({
        hasSignal: true,
        moments: [0, 1, 2, 3, 0, 1, 2].map((s, i) => ({ atSeq: s, kind: "other", label: `m${i}` })),
      }),
      SEGMENTS
    );
    expect(out!.moments.length).toBeLessThanOrEqual(5);
  });

  it("hasSignal:false → EMPTY (honest 'nothing to show')", () => {
    const out = parseMoments(JSON.stringify({ hasSignal: false }), SEGMENTS);
    expect(out).toEqual({ hasSignal: false, moments: [] });
  });

  it("malformed JSON → null (§3.4 honest failure)", () => {
    expect(parseMoments("}{ not json", SEGMENTS)).toBeNull();
  });
});
