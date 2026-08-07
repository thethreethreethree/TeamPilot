import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Engine-level LENGTH GUARDS (execution, not just the pure parser). Dissect and coach short-circuit to
 * honest-EMPTY on trivial input BEFORE spending an LLM call — a real behavior (§3.4 don't manufacture a read
 * from nothing, and don't burn tokens on a fragment) that the parser tests don't cover. These assert the LLM
 * is NOT called below the threshold, and IS called above it. Closes the "decision tested, execution untested"
 * gap: the guard expression is only meaningful if the engine actually returns before the LLM.
 */

vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));

import { dissectCoachV5 } from "@/lib/claude";
import {
  generateSalesTextDissect,
  EMPTY_SALES_TEXT_DISSECT,
} from "@/lib/coach/extension/salesTextDissect";
import {
  generateSalesReplyCoaching,
  EMPTY_SALES_REPLY_COACHING,
} from "@/lib/coach/extension/salesReplyCoach";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("generateSalesTextDissect — length guard (<40 chars)", () => {
  it("returns EMPTY without calling the LLM on a fragment", async () => {
    const out = await generateSalesTextDissect({ sourceText: "hi there" });
    expect(out).toEqual(EMPTY_SALES_TEXT_DISSECT);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("calls the LLM on a real-length conversation", async () => {
    asMock(dissectCoachV5).mockResolvedValue({
      text: JSON.stringify({
        hasSignal: true,
        summary: "early discovery; prospect named a speed problem",
        strengths: [],
        opportunity: "quantify the pain",
        nextMove: "ask the cost of the delay",
        guidingQuestion: "what's the real driver?",
      }),
    });
    const longText = "Rep: what's driving the timing? Prospect: our current tool is too slow for the team.";
    const out = await generateSalesTextDissect({ sourceText: longText });
    expect(dissectCoachV5).toHaveBeenCalledTimes(1);
    expect(out.hasSignal).toBe(true);
    expect(out.opportunity).toBe("quantify the pain");
  });
});

describe("generateSalesReplyCoaching — draft length guard (<10 chars)", () => {
  it("returns EMPTY without calling the LLM on a trivial draft", async () => {
    const out = await generateSalesReplyCoaching({ conversation: "a full sales thread here", draft: "ok" });
    expect(out).toEqual(EMPTY_SALES_REPLY_COACHING);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("calls the LLM on a real draft", async () => {
    asMock(dissectCoachV5).mockResolvedValue({
      text: JSON.stringify({
        hasSignal: true,
        assessment: "leads with the product",
        strengths: ["courteous"],
        improvements: [{ point: "name the problem first", why: "SPIN" }],
        suggestedRevision: "What does the delay cost you weekly?",
        guidingQuestion: "what do they care about?",
      }),
    });
    const out = await generateSalesReplyCoaching({
      conversation: "a full sales thread here",
      draft: "Hi, I wanted to follow up on our pricing conversation from last week.",
    });
    expect(dissectCoachV5).toHaveBeenCalledTimes(1);
    expect(out.hasSignal).toBe(true);
    expect(out.improvements[0]?.point).toContain("name the problem");
  });
});
