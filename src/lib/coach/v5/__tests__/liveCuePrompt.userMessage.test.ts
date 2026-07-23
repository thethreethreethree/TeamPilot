import { describe, it, expect } from "vitest";
import { buildLiveCueUserMessage } from "../liveCuePrompt";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * Locks the DIARIZATION invariant of the LIVE cue user-message (real-time coaching shown to the rep
 * DURING a call). If a turn loses its speaker label, the cue misattributes who said what at a critical
 * live moment — and the stall logic explicitly reads "the LAST AGENT TURN", so mislabeling also breaks
 * the sacred-silence guard (§3.3). Same role-attribution class as the score/review builders (A39).
 * Completes the diarization-builder coverage for the LIVE one; intel/pivot (internal analysis) remain a
 * bounded residual for the shared-speaker-label consolidation.
 */
const seg = (
  speaker: TranscriptSegment["speaker"],
  text: string,
  seq: number
): TranscriptSegment => ({
  id: `s${seq}`,
  sessionId: "sess1",
  speaker,
  text,
  seq,
  spokenAt: null,
});

describe("buildLiveCueUserMessage — diarization", () => {
  const recentSegments = [
    seg("agent", "So what's holding you back?", 0),
    seg("customer", "Honestly, the price.", 1),
    seg("unknown", "[background noise]", 2),
  ];

  it("labels each turn with its role (agent→AGENT, customer→CUSTOMER, unknown→UNKNOWN)", () => {
    const out = buildLiveCueUserMessage({ recentSegments });
    expect(out).toContain("AGENT: So what's holding you back?");
    expect(out).toContain("CUSTOMER: Honestly, the price.");
    expect(out).toContain("UNKNOWN: [background noise]");
  });

  it("includes every segment's text (nothing dropped)", () => {
    const out = buildLiveCueUserMessage({ recentSegments });
    for (const s of recentSegments) expect(out).toContain(s.text);
  });

  it("renders the context header per mode, omits when absent", () => {
    expect(buildLiveCueUserMessage({ context: "in_person", recentSegments })).toContain(
      "in-person, door-to-door"
    );
    expect(buildLiveCueUserMessage({ context: "video", recentSegments })).toContain(
      "online video call"
    );
    expect(buildLiveCueUserMessage({ recentSegments })).not.toContain("Context:");
  });
});
