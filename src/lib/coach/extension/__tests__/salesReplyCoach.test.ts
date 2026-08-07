import { describe, it, expect } from "vitest";
import {
  parseSalesReplyCoaching,
  salesReplyCoachSystemPrompt,
  EMPTY_SALES_REPLY_COACHING,
} from "@/lib/coach/extension/salesReplyCoach";

/**
 * Reply coaching locks two honesty properties: (1) structural — a result with no assessment, no
 * improvement, and no revision degrades to EMPTY rather than rendering an empty shell (§3.4); (2) the
 * prompt always grounds in the sales methodology + carries the injection fence. The LLM call is not tested.
 */

describe("parseSalesReplyCoaching — structural honesty", () => {
  it("keeps a real coaching result", () => {
    const model = JSON.stringify({
      hasSignal: true,
      assessment: "polite but leads with the product, not the prospect's problem",
      strengths: ["courteous tone"],
      improvements: [
        { point: "open by naming their stated problem", why: "SPIN — problem before solution earns the right to pitch" },
      ],
      suggestedRevision: "You mentioned speed is the pain — before I show the tool, what does the delay cost you weekly?",
      guidingQuestion: "what's the one outcome they said they care about?",
    });
    const c = parseSalesReplyCoaching(model);
    expect(c.hasSignal).toBe(true);
    expect(c.improvements).toHaveLength(1);
    expect(c.improvements[0]?.point).toContain("open by naming");
  });

  it("returns EMPTY when the model declares hasSignal:false", () => {
    expect(parseSalesReplyCoaching(JSON.stringify({ hasSignal: false }))).toEqual(
      EMPTY_SALES_REPLY_COACHING
    );
  });

  it("returns EMPTY on non-JSON", () => {
    expect(parseSalesReplyCoaching("not json")).toEqual(EMPTY_SALES_REPLY_COACHING);
  });

  it("returns EMPTY when there is no assessment, no improvement, and no revision", () => {
    const model = JSON.stringify({
      hasSignal: true,
      assessment: "",
      strengths: ["nice"],
      improvements: [],
      suggestedRevision: "",
      guidingQuestion: "hmm?",
    });
    expect(parseSalesReplyCoaching(model)).toEqual(EMPTY_SALES_REPLY_COACHING);
  });

  it("drops an improvement with no point, caps arrays", () => {
    const model = JSON.stringify({
      hasSignal: true,
      assessment: "ok",
      strengths: ["a", "b", "c", "d", "e", "f", "g"],
      improvements: [
        { point: "", why: "orphan why" },
        { point: "real point", why: "real why" },
      ],
      suggestedRevision: "better",
      guidingQuestion: "q",
    });
    const c = parseSalesReplyCoaching(model);
    expect(c.strengths).toHaveLength(5);
    expect(c.improvements).toHaveLength(1);
    expect(c.improvements[0]?.point).toBe("real point");
  });
});

describe("salesReplyCoachSystemPrompt — methodology + anchor + fence", () => {
  it("grounds in the sales methodology block", () => {
    // methodologyBlock returns the KB or the inline starter; either way it labels itself a knowledge base.
    expect(salesReplyCoachSystemPrompt()).toMatch(/SALES (KNOWLEDGE BASE|METHODOLOGY)/i);
  });

  it("names the rep as the WHO-IS-WHO anchor when provided", () => {
    expect(salesReplyCoachSystemPrompt("Dana")).toContain("Dana is the SALES REP");
  });

  it("always carries the shared conversation-is-data injection fence", () => {
    expect(salesReplyCoachSystemPrompt("Dana")).toContain("Untrusted input: the conversation");
    expect(salesReplyCoachSystemPrompt()).toContain("Untrusted input: the conversation");
  });
});
