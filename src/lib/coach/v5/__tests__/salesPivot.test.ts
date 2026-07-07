import { describe, expect, it } from "vitest";
import { parsePivot } from "../salesPivot";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * parsePivot enforces the constitutional invariants of the Pivot Moment engine
 * (§3.4 grounding, §A11 no-naked-verdict). These pin them so a refactor can't
 * silently let the coach fabricate a turning point that isn't in the transcript.
 */

const seg = (
  seq: number,
  speaker: TranscriptSegment["speaker"],
  text: string,
  spokenAt: string | null = null
): TranscriptSegment =>
  ({ id: `s${seq}`, sessionId: "x", speaker, text, seq, spokenAt }) as TranscriptSegment;

const SEGMENTS: TranscriptSegment[] = [
  seg(0, "agent", "Hi, quick question about your internet.", "2026-07-07T10:00:00Z"),
  seg(1, "customer", "I'm busy, what is this?", "2026-07-07T10:00:12Z"),
  seg(2, "agent", "Totally — most neighbors save about $60/mo.", "2026-07-07T10:01:04Z"),
  seg(3, "customer", "Oh really? Tell me more.", "2026-07-07T10:01:20Z"),
];

function pivot(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    hasSignal: true,
    pivot: {
      atSeq: 3,
      direction: "gained",
      label: "Interest won on savings",
      customerLine: "Oh really? Tell me more.",
      repLine: "most neighbors save about $60/mo.",
      whatHappened: "The prospect went from dismissive to curious.",
      whyItMattered: "Concrete savings gave a reason to keep listening.",
      ...overrides,
    },
  });
}

describe("parsePivot", () => {
  it("parses a valid 'gained' pivot and computes the timestamp from spoken_at", () => {
    const r = parsePivot(pivot(), SEGMENTS);
    expect(r?.hasSignal).toBe(true);
    expect(r?.pivot?.direction).toBe("gained");
    expect(r?.pivot?.atSeq).toBe(3);
    // seg 3 spoken at 10:01:20, origin 10:00:00 → 1:20.
    expect(r?.pivot?.timestampLabel).toBe("1:20");
  });

  it("parses a valid 'lost' pivot", () => {
    const r = parsePivot(pivot({ direction: "lost" }), SEGMENTS);
    expect(r?.pivot?.direction).toBe("lost");
  });

  it("returns empty when hasSignal is false (honest silence)", () => {
    const r = parsePivot(JSON.stringify({ hasSignal: false, pivot: null }), SEGMENTS);
    expect(r?.hasSignal).toBe(false);
    expect(r?.pivot).toBeNull();
  });

  it("DROPS a pivot whose atSeq is not a real segment (§3.4 grounding)", () => {
    const r = parsePivot(pivot({ atSeq: 99 }), SEGMENTS);
    expect(r?.hasSignal).toBe(false);
    expect(r?.pivot).toBeNull();
  });

  it("DROPS a pivot with an invalid direction (no third state)", () => {
    const r = parsePivot(pivot({ direction: "neutral" }), SEGMENTS);
    expect(r?.pivot).toBeNull();
  });

  it("DROPS a pivot missing the explanation (§A11 no naked verdict)", () => {
    expect(parsePivot(pivot({ whatHappened: "" }), SEGMENTS)?.pivot).toBeNull();
    expect(parsePivot(pivot({ whyItMattered: "  " }), SEGMENTS)?.pivot).toBeNull();
  });

  it("returns null on malformed JSON (degrade to caller's EMPTY)", () => {
    expect(parsePivot("not json", SEGMENTS)).toBeNull();
  });

  it("leaves timestampLabel null when the anchor segment has no spoken_at", () => {
    const noClock = [
      seg(0, "agent", "Hi."),
      seg(1, "customer", "Busy."),
      seg(2, "agent", "Neighbors save money."),
      seg(3, "customer", "Tell me more."),
    ];
    const r = parsePivot(pivot(), noClock);
    expect(r?.pivot?.timestampLabel).toBeNull();
  });
});
