import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateSalesReview — the empty-state HONESTY GATE on the post-call read, and the never-throws contract.
 * parseSalesReview (the tone law) is covered in salesReview.test.ts; this covers the OTHER half the
 * parse tests can't see: the input-side gate that decides whether there's enough of the rep's OWN
 * behaviour to coach at all, and the failure paths that must degrade to the honest empty state instead
 * of fabricating a lesson or throwing.
 *
 * The `< 3 agent turns → empty` case is what drives the After-Pitch "Your read" honest "too short"
 * state (the always-render change 2026-08-04): below the floor there is no real read, and — proven
 * here — the LLM is never even called, so a thin call can't fabricate one.
 *
 * Deps are mocked via the `@/` alias, which vitest resolves to the same module id as salesReview.ts's
 * own relative `./salesReviewPrompt` import, so the mock intercepts the source's import too.
 */
vi.mock("@/lib/claude", () => ({ debriefCoachV5: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/coach/v5/salesReviewPrompt", () => ({
  buildSalesReviewSystemPrompt: () => "SYS",
  buildSalesReviewUserMessage: () => "USER",
}));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));

import { debriefCoachV5 } from "@/lib/claude";
import { generateSalesReview } from "../salesReview";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number) => ({ id: `s${i}`, speaker, text: "x", seq: i });
const gen = (segments: ReturnType<typeof seg>[]) =>
  generateSalesReview({ companyId: "co1", segments } as Parameters<typeof generateSalesReview>[0]);

beforeEach(() => vi.clearAllMocks());

describe("generateSalesReview — honesty gate + never-throws", () => {
  it("fewer than 3 agent turns → honest empty state, WITHOUT calling the LLM", async () => {
    // 2 agent turns (one customer turn interleaved) — below MIN_AGENT_SEGMENTS.
    const out = await gen([seg("agent", 0), seg("customer", 1), seg("agent", 2)]);
    expect(out).toEqual({ hasSignal: false, strengths: [], growthAreas: [] });
    expect(debriefCoachV5).not.toHaveBeenCalled(); // short-circuits before spending an LLM call — no fabrication
  });

  it("3+ agent turns with a valid model review → hasSignal, strengths passed through", async () => {
    asMock(debriefCoachV5).mockResolvedValue({
      suppressed: false,
      text: JSON.stringify({
        strengths: [{ point: "strong open", example: "you led with their name" }],
        growthAreas: [],
        closing: "nice work",
      }),
    });
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(true);
    expect(out.strengths).toHaveLength(1);
    expect(out.closing).toBe("nice work");
    expect(debriefCoachV5).toHaveBeenCalledTimes(1);
  });

  it("a suppressed LLM response → empty (never surfaces suppressed content)", async () => {
    asMock(debriefCoachV5).mockResolvedValue({ suppressed: true, text: "" });
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(false);
  });

  it("never throws — an LLM error degrades to the honest empty state", async () => {
    asMock(debriefCoachV5).mockRejectedValue(new Error("provider down"));
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out).toEqual({ hasSignal: false, strengths: [], growthAreas: [] });
  });
});
