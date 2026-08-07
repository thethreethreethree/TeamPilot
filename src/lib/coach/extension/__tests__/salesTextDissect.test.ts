import { describe, it, expect } from "vitest";
import {
  parseSalesTextDissect,
  salesTextDissectSystemPrompt,
  EMPTY_SALES_TEXT_DISSECT,
} from "@/lib/coach/extension/salesTextDissect";

/**
 * The grounding contract is the whole point of the text-in sales dissect: a "strength" the model claims must
 * quote a REAL line from the pasted conversation, or it is dropped (§3.4 — a hallucinated quote never renders
 * as fact). These lock the pure parse + the prompt anchor. The LLM call itself is not tested here.
 */

const SOURCE = `Rep: Thanks for hopping on — what's driving the timing on this?
Prospect: Honestly our current tool is too slow and the team is frustrated.
Rep: That makes sense. If speed is the issue, what would "fast enough" look like?`;

describe("parseSalesTextDissect — grounding + honest-empty", () => {
  it("keeps a strength whose excerpt really appears in the source", () => {
    const model = JSON.stringify({
      hasSignal: true,
      summary: "prospect frustrated with speed; rep is running discovery",
      strengths: [
        { point: "opened with a discovery question", excerpt: "what's driving the timing on this?" },
      ],
      opportunity: "quantify the cost of the slowness",
      nextMove: "ask what the slowness costs them per week",
      guidingQuestion: "what's the real pain under 'too slow'?",
    });
    const d = parseSalesTextDissect(model, SOURCE);
    expect(d.hasSignal).toBe(true);
    expect(d.strengths).toHaveLength(1);
    expect(d.strengths[0]?.point).toBe("opened with a discovery question");
  });

  it("DROPS a strength whose excerpt is NOT in the source (hallucinated quote)", () => {
    const model = JSON.stringify({
      hasSignal: true,
      summary: "discovery in progress",
      strengths: [
        { point: "opened with discovery", excerpt: "what's driving the timing on this?" },
        { point: "cited a case study", excerpt: "our clients see 40% faster onboarding" }, // not in SOURCE
      ],
      opportunity: "x",
      nextMove: "y",
      guidingQuestion: "z",
    });
    const d = parseSalesTextDissect(model, SOURCE);
    expect(d.strengths).toHaveLength(1);
    expect(d.strengths[0]?.excerpt).toBe("what's driving the timing on this?");
  });

  it("matches a reformatted-but-real quote (whitespace-normalized)", () => {
    const model = JSON.stringify({
      hasSignal: true,
      summary: "s",
      strengths: [{ point: "reflective listening", excerpt: "our current tool is too slow   and the team is frustrated." }],
      opportunity: "o",
      nextMove: "n",
      guidingQuestion: "q",
    });
    const d = parseSalesTextDissect(model, SOURCE);
    expect(d.strengths).toHaveLength(1);
  });

  it("returns EMPTY when the model declares hasSignal:false", () => {
    expect(parseSalesTextDissect(JSON.stringify({ hasSignal: false }), SOURCE)).toEqual(
      EMPTY_SALES_TEXT_DISSECT
    );
  });

  it("returns EMPTY on non-JSON", () => {
    expect(parseSalesTextDissect("not json", SOURCE)).toEqual(EMPTY_SALES_TEXT_DISSECT);
  });

  it("returns EMPTY when nothing survives grounding and there is no summary", () => {
    const model = JSON.stringify({
      hasSignal: true,
      summary: "",
      strengths: [{ point: "made a claim", excerpt: "this quote is not present anywhere" }],
      opportunity: "",
      nextMove: "",
      guidingQuestion: "",
    });
    expect(parseSalesTextDissect(model, SOURCE)).toEqual(EMPTY_SALES_TEXT_DISSECT);
  });

  it("keeps a real read even with zero grounded strengths, as long as there is a summary", () => {
    const model = JSON.stringify({
      hasSignal: true,
      summary: "early discovery; prospect named a speed problem",
      strengths: [],
      opportunity: "quantify the pain",
      nextMove: "ask the cost of the delay",
      guidingQuestion: "what's the real driver?",
    });
    const d = parseSalesTextDissect(model, SOURCE);
    expect(d.hasSignal).toBe(true);
    expect(d.opportunity).toBe("quantify the pain");
  });
});

describe("salesTextDissectSystemPrompt — rep anchor + injection fence", () => {
  it("names the rep as the WHO-IS-WHO anchor when provided", () => {
    const p = salesTextDissectSystemPrompt("Dana");
    expect(p).toContain("Dana is the SALES REP");
  });

  it("omits the anchor when no rep name is given", () => {
    expect(salesTextDissectSystemPrompt()).not.toContain("WHO IS WHO");
  });

  it("always carries the shared conversation-is-data injection fence", () => {
    // Assert the actual CONVERSATION_IS_DATA fence text (not our own grounding line) is appended, so a
    // refactor can't drop the prompt-injection defense silently.
    expect(salesTextDissectSystemPrompt("Dana")).toContain("Untrusted input: the conversation");
    expect(salesTextDissectSystemPrompt()).toContain("Untrusted input: the conversation");
  });
});
