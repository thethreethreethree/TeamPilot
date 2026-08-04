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
});
