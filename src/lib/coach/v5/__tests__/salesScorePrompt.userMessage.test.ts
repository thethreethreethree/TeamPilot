import { describe, it, expect } from "vitest";
import { buildSalesScoreUserMessage } from "../salesScorePrompt";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * Locks the DIARIZATION invariant of the score user-message. This message feeds the RUBRIC SCORER
 * (the private §3.5 scoreboard), so every turn MUST be labelled with its speaker (REP vs CUSTOMER)
 * and the "REP is the person being scored" anchor MUST be present — otherwise the scorer grades the
 * wrong person, the same role-attribution failure the C.A.R.E extension hit. Pure string builder, so
 * this is a cheap, non-brittle pin of the load-bearing structure (not the prose).
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

describe("buildSalesScoreUserMessage — diarization + scorer anchor", () => {
  const segments = [
    seg("agent", "Hi, thanks for taking my call.", 0),
    seg("customer", "Sure, what's this about?", 1),
    seg("unknown", "[inaudible]", 2),
  ];

  it("labels each turn with its role (agent→REP, customer→CUSTOMER, unknown→UNKNOWN)", () => {
    const out = buildSalesScoreUserMessage({ segments });
    expect(out).toContain("REP: Hi, thanks for taking my call.");
    expect(out).toContain("CUSTOMER: Sure, what's this about?");
    expect(out).toContain("UNKNOWN: [inaudible]");
  });

  it("anchors WHO is scored (REP), so the scorer grades the salesperson not the customer", () => {
    const out = buildSalesScoreUserMessage({ segments });
    expect(out).toMatch(/REP is the person being scored/i);
  });

  it("includes every segment's text (nothing dropped)", () => {
    const out = buildSalesScoreUserMessage({ segments });
    for (const s of segments) expect(out).toContain(s.text);
  });

  it("renders the context header per mode (in_person vs video), and omits it when absent", () => {
    expect(buildSalesScoreUserMessage({ context: "in_person", segments })).toContain(
      "in-person, door-to-door"
    );
    expect(buildSalesScoreUserMessage({ context: "video", segments })).toContain(
      "online video call"
    );
    expect(buildSalesScoreUserMessage({ segments })).not.toContain("Context:");
  });

  it("asks for JSON only (the caller parses structured output)", () => {
    expect(buildSalesScoreUserMessage({ segments })).toMatch(/JSON only/i);
  });
});
