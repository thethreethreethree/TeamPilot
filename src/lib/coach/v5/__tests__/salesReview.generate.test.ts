import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateSalesReview — the empty-state HONESTY GATE on the post-call read, and the never-throws contract.
 * parseSalesReview (the tone law) is covered in salesReview.test.ts; this covers the OTHER half the
 * parse tests can't see: the input-side gate that decides whether there's enough of the rep's OWN
 * behaviour to coach at all, and the failure paths that must degrade to the honest empty state instead
 * of fabricating a lesson or throwing.
 *
 * Founder 2026-08-05 ("don't put a minimum time — every session gets all content"): the length floor
 * is removed. A read is generated for EVERY session with at least one rep turn, however short — sales
 * agent feedback was that real 5-7 min pitches were wrongly judged "too short to read". The ONLY input
 * that short-circuits before the LLM is a genuinely empty rep side (0 agent turns — a capture gap),
 * matching the talk-ratio capture-gap honesty; a thin-but-real call now gets a real, grounded read.
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
  it("ZERO agent turns (rep-silent capture gap) → honest empty state, WITHOUT calling the LLM", async () => {
    // No rep turns at all — nothing of the rep's OWN behaviour to read (a one-sided capture).
    // This is the ONLY input that short-circuits before the LLM (§3.4 — no rep, no rep read).
    const out = await gen([seg("customer", 0), seg("customer", 1)]);
    expect(out).toEqual({ hasSignal: false, strengths: [], growthAreas: [] });
    expect(debriefCoachV5).not.toHaveBeenCalled(); // short-circuits before spending an LLM call — no fabrication
  });

  it("a SHORT call (2 agent turns) → now generates a real read (founder 2026-08-05: no minimum time)", async () => {
    asMock(debriefCoachV5).mockResolvedValue({
      suppressed: false,
      text: JSON.stringify({
        strengths: [{ point: "clear opener", example: "you led with the offer" }],
        growthAreas: [],
        closing: "good start",
      }),
    });
    // 2 agent turns — below the OLD floor of 3; must now produce a read, not an empty state.
    const out = await gen([seg("agent", 0), seg("customer", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(true);
    expect(out.strengths).toHaveLength(1);
    expect(debriefCoachV5).toHaveBeenCalledTimes(1); // the LLM IS called for a short-but-real call
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

  // INV22 / starvation VISIBILITY on the ORIGINAL outage engine: generateSalesReview → debriefCoachV5 was the
  // actual engine whose "Your read" went blank for 2 weeks in 2026-07-30 (a reasoning-model finish_reason:"length"
  // empty response swallowed silently). It must LOG loudly, not swallow the empty as an honest state. Lock it.
  it("EMPTY-but-successful LLM response → RETRIES (starvation recovery) then empty AND logs loudly", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Empty on BOTH attempts → after the leaner retry also starves, the honest empty state (logged each time).
    asMock(debriefCoachV5).mockResolvedValue({ suppressed: false, text: "", model: "deepseek-v4-flash", provider: "deepseek" });
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(false);
    expect(debriefCoachV5).toHaveBeenCalledTimes(2); // starvation → one leaner retry before giving up
    expect(spy.mock.calls.some((c) => /EMPTY text|starvation/i.test(String(c[0])))).toBe(true);
    spy.mockRestore();
  });

  it("a successful-but-unparseable LLM response → RETRIES then empty AND logs the no-signal reason", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    asMock(debriefCoachV5).mockResolvedValue({ suppressed: false, text: "not json at all", model: "deepseek-v4-flash", provider: "deepseek" });
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(false);
    expect(debriefCoachV5).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.some((c) => /no signal|parse/i.test(String(c[0])))).toBe(true);
    spy.mockRestore();
  });

  it("STARVATION RECOVERY (2026-08-14): a first EMPTY attempt is RETRIED leaner and the valid retry returns the read", async () => {
    // The exact 2-device test failure: attempt 1 (full corpus prompt) starves → empty; the leaner retry succeeds.
    // Every call must get a read — a starved first pass no longer leaves the rep with a blank "Your read".
    asMock(debriefCoachV5)
      .mockResolvedValueOnce({ suppressed: false, text: "", model: "deepseek-v4-flash", provider: "deepseek" })
      .mockResolvedValueOnce({
        suppressed: false,
        text: JSON.stringify({
          strengths: [{ point: "recovered read", example: "you asked a discovery question" }],
          growthAreas: [],
          closing: "solid",
        }),
      });
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(true);
    expect(out.strengths[0]?.point).toBe("recovered read");
    expect(debriefCoachV5).toHaveBeenCalledTimes(2);
  });
});
