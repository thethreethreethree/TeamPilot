import { describe, it, expect } from "vitest";
import { buildSalesReviewUserMessage } from "../salesReviewPrompt";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * Locks the DIARIZATION invariant of the review user-message. This feeds the post-conversation growth
 * REVIEW shown to the rep (§3.6 make-learning-visible), so every turn must be labelled with its speaker
 * (AGENT vs CUSTOMER) and the "AGENT is the person you are coaching" anchor must be present — else the
 * review misattributes the rep's own lines, a §3.6 honesty failure (same class as the score builder and
 * the C.A.R.E extension role bug). Companion to salesScorePrompt.userMessage.test.ts.
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

describe("buildSalesReviewUserMessage — diarization + coachee anchor", () => {
  const segments = [
    seg("agent", "Let me walk you through the options.", 0),
    seg("customer", "Okay, I'm listening.", 1),
    seg("unknown", "[crosstalk]", 2),
  ];

  it("labels each turn with its role (agent→AGENT, customer→CUSTOMER, unknown→UNKNOWN)", () => {
    const out = buildSalesReviewUserMessage({ segments });
    expect(out).toContain("AGENT: Let me walk you through the options.");
    expect(out).toContain("CUSTOMER: Okay, I'm listening.");
    expect(out).toContain("UNKNOWN: [crosstalk]");
  });

  it("anchors WHO is being coached (AGENT), so the review credits the rep's own lines", () => {
    expect(buildSalesReviewUserMessage({ segments })).toMatch(
      /AGENT is the person you are coaching/i
    );
  });

  it("includes every segment's text (nothing dropped)", () => {
    const out = buildSalesReviewUserMessage({ segments });
    for (const s of segments) expect(out).toContain(s.text);
  });

  it("renders optional session title + context header, omits when absent", () => {
    const withHeader = buildSalesReviewUserMessage({
      sessionTitle: "Acme renewal call",
      context: "in_person",
      segments,
    });
    expect(withHeader).toContain("Conversation: Acme renewal call");
    expect(withHeader).toContain("in-person, door-to-door");
    expect(buildSalesReviewUserMessage({ context: "video", segments })).toContain(
      "online video call"
    );
    const bare = buildSalesReviewUserMessage({ segments });
    expect(bare).not.toContain("Context:");
    expect(bare).not.toContain("Conversation:");
  });

  it("asks for JSON only", () => {
    expect(buildSalesReviewUserMessage({ segments })).toMatch(/JSON only/i);
  });
});
