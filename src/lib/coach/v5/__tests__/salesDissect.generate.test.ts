import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateSalesDissect — the input-side length behaviour of the Dissect (the founder's third named
 * deliverable: "<My read> <Summarize> <Dissect>"), and the never-throws contract. parseDissect (the
 * structural TONE LAW) is covered in salesDissect.test.ts; this covers the OTHER half — the gate that
 * decides whether a session is dissected at all.
 *
 * Founder 2026-08-05 ("don't put a minimum time — every session gets all content"): the length floor is
 * removed. A session with at least one rep turn is now dissected; ONLY a genuinely empty rep side (0 agent
 * turns — a capture gap) short-circuits before the LLM. This test LOCKS that so a future edit can't
 * silently reintroduce the floor (A30 — encode the lesson in a gate), consistent with the review + score
 * guards for the other two named surfaces.
 */
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/coach/v5/salesDissectPrompt", () => ({ buildSalesDissectSystemPrompt: () => "SYS" }));
vi.mock("@/lib/coach/v5/salesReviewPrompt", () => ({ buildSalesReviewUserMessage: () => "USER" }));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { dissectCoachV5 } from "@/lib/claude";
import { generateSalesDissect } from "../salesDissect";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number) => ({ id: `s${i}`, speaker, text: "x", seq: i });
const gen = (segments: ReturnType<typeof seg>[]) =>
  generateSalesDissect({ companyId: "co1", segments } as Parameters<typeof generateSalesDissect>[0]);

// A well-formed dissect (>=1 strength — the structural tone law that parseDissect requires).
const dissectOk = {
  suppressed: false,
  text: JSON.stringify({
    strengths: [{ point: "clear opener", example: "you led with the offer", why: "earns the first moments" }],
    growthAreas: [],
    standoutStrategy: null,
    overall: "solid short call",
  }),
};

beforeEach(() => vi.clearAllMocks());

describe("generateSalesDissect — length behaviour + never-throws", () => {
  it("ZERO agent turns (rep-silent capture gap) → honest empty, WITHOUT calling the LLM", async () => {
    const out = await gen([seg("customer", 0), seg("customer", 1)]);
    expect(out.hasSignal).toBe(false);
    expect(out.strengths).toEqual([]);
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("a SHORT call (2 agent turns) → now dissected (founder 2026-08-05: no minimum time)", async () => {
    asMock(dissectCoachV5).mockResolvedValue(dissectOk);
    const out = await gen([seg("agent", 0), seg("customer", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(true);
    expect(out.strengths).toHaveLength(1);
    expect(dissectCoachV5).toHaveBeenCalledTimes(1); // the LLM IS called for a short-but-real call
  });

  it("a suppressed LLM response → empty (never surfaces suppressed content)", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: true, text: "" });
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(false);
  });

  it("never throws — an LLM error degrades to the honest empty state", async () => {
    asMock(dissectCoachV5).mockRejectedValue(new Error("provider down"));
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(false);
    expect(out.strengths).toEqual([]);
  });

  // INV22 / starvation VISIBILITY: an EMPTY-but-successful LLM response (finish_reason:"length" → blank content)
  // is the exact 2026-07-30 reasoning-starvation symptom that went silent for 2 weeks. The engine must NOT
  // swallow it as an honest empty state — it must LOG loudly so a recurrence surfaces immediately (salesDissect.ts
  // deliberately distinguishes the three outcomes for this reason). These lock that instrumentation.
  it("EMPTY-but-successful LLM response (starvation symptom) → empty AND logs loudly (never silent again)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "", model: "deepseek-v4-flash", provider: "deepseek" });
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(false);
    expect(out.strengths).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/EMPTY text|starvation/i);
    spy.mockRestore();
  });

  it("a successful-but-unparseable LLM response → empty AND logs the no-signal reason (not a silent blank)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "not json at all", model: "deepseek-v4-flash", provider: "deepseek" });
    const out = await gen([seg("agent", 0), seg("agent", 1), seg("agent", 2)]);
    expect(out.hasSignal).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/no signal|parse/i);
    spy.mockRestore();
  });
});

/**
 * WHICH empty (2026-09-10). Measured on production: 92 of 100 stored declines say "no_signal" and cannot say
 * which of four different things happened. Each shape below already had its own console.error sentence here
 * and each was discarded at `return EMPTY`, so the durable record could never separate token starvation —
 * which a longer transcript makes WORSE and more time does not fix — from a call that genuinely had nothing
 * to praise. These pin the distinction so it cannot be collapsed again.
 */
describe("generateSalesDissect — the empty carries WHICH empty it is", () => {
  it("0 agent turns → no_agent_turns, and the LLM is never called", async () => {
    const out = await gen([seg("customer", 0)]);
    expect(out.emptyShape).toBe("no_agent_turns");
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("a suppressed response → suppressed (a policy decline, NOT a model failure)", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: true, text: "" });
    const out = await gen([seg("agent", 0), seg("customer", 1)]);
    expect(out.emptyShape).toBe("suppressed");
  });

  it("EMPTY text back from the model → llm_empty — this is the starvation shape", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "   " });
    const out = await gen([seg("agent", 0), seg("customer", 1)]);
    expect(out.emptyShape).toBe("llm_empty");
    expect(out.hasSignal).toBe(false);
  });

  it("text that is not dissect JSON → unparsable, NOT llm_empty (a different fix entirely)", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "I'm sorry, I can't help." });
    const out = await gen([seg("agent", 0), seg("customer", 1)]);
    expect(out.emptyShape).toBe("unparsable");
  });

  it("valid JSON with growth but NO strengths → no_strengths — the tone law refusing criticism-only", async () => {
    asMock(dissectCoachV5).mockResolvedValue({
      suppressed: false,
      text: JSON.stringify({
        strengths: [],
        growthAreas: [{ opportunity: "ask more", nextStep: "prepare two questions", why: "discovery was thin" }],
        standoutStrategy: null,
      }),
    });
    const out = await gen([seg("agent", 0), seg("customer", 1)]);
    expect(out.emptyShape).toBe("no_strengths");
  });

  it("a throw on the path → threw, and still never throws to the caller", async () => {
    asMock(dissectCoachV5).mockRejectedValue(new Error("upstream exploded"));
    const out = await gen([seg("agent", 0), seg("customer", 1)]);
    expect(out.emptyShape).toBe("threw");
    expect(out.hasSignal).toBe(false);
  });

  it("a dissect WITH signal carries no shape at all — the field means 'which empty', not 'which outcome'", async () => {
    asMock(dissectCoachV5).mockResolvedValue(dissectOk);
    const out = await gen([seg("agent", 0), seg("customer", 1)]);
    expect(out.hasSignal).toBe(true);
    expect(out.emptyShape).toBeUndefined();
  });
});
