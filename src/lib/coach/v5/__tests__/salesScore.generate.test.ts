import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateSalesScores — the input-side length behaviour of the private scoreboard, and the never-throws
 * contract. parseGraded (measurement honesty) is covered in salesScore.test.ts; this covers the OTHER
 * half: the gate that decides whether a session is scored at all, plus the degrade-don't-fabricate paths.
 *
 * Founder 2026-08-05 ("don't put a minimum time — every session gets all content"): the length floor is
 * removed. This is the surface the founder's report named directly — a real 5-7 min pitch showed "only 2
 * of the scores". A session with at least one rep turn is now graded; ONLY a genuinely empty rep side
 * (0 agent turns — a capture gap) short-circuits before the LLM. This test LOCKS that so a future edit
 * can't silently reintroduce the floor (A30 — encode the lesson in a gate).
 *
 * Deps mocked via the `@/` alias, which vitest resolves to the same module id as salesScore.ts's own
 * relative imports, so the mock intercepts the source too. `./grounding` is intentionally NOT mocked —
 * the computed talk/question categories don't depend on it, which is what these assertions rest on.
 */
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/coach/v5/salesScorePrompt", () => ({
  buildSalesScoreSystemPrompt: () => "SYS",
  buildSalesScoreUserMessage: () => "USER",
}));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));

import { dissectCoachV5 } from "@/lib/claude";
import { generateSalesScores } from "../salesScore";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number, text: string) => ({ id: `s${i}`, speaker, text, seq: i });
const gen = (segments: ReturnType<typeof seg>[]) =>
  generateSalesScores({ companyId: "co1", segments } as Parameters<typeof generateSalesScores>[0]);

// A well-formed LLM grade (rationale present so parseGraded keeps it).
const gradedOk = {
  suppressed: false,
  text: JSON.stringify({
    categories: [{ key: "opener", score: 7, rationale: "warm open", citation: "how are you today" }],
  }),
};

beforeEach(() => vi.clearAllMocks());

describe("generateSalesScores — length behaviour + never-throws", () => {
  it("ZERO agent turns (rep-silent capture gap) → honest empty, WITHOUT calling the LLM", async () => {
    const out = await gen([seg("customer", 0, "hello"), seg("customer", 1, "im here")]);
    expect(out).toEqual({ hasSignal: false, categories: [] });
    expect(dissectCoachV5).not.toHaveBeenCalled();
  });

  it("a SHORT call (2 agent turns) → now graded (founder 2026-08-05: no minimum time)", async () => {
    asMock(dissectCoachV5).mockResolvedValue(gradedOk);
    const out = await gen([
      seg("agent", 0, "hi there how are you today"),
      seg("customer", 1, "im good thanks"),
      seg("agent", 2, "great, can I show you something?"),
    ]);
    expect(out.hasSignal).toBe(true);
    expect(dissectCoachV5).toHaveBeenCalledTimes(1); // the LLM IS called for a short-but-real call
    // The deterministic computed categories are always present on a two-sided call.
    const keys = out.categories.map((c) => c.key);
    expect(keys).toContain("talk_ratio");
    expect(keys).toContain("question_rate");
  });

  it("a suppressed LLM response → still surfaces the computed scores (degrade, don't fabricate)", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: true, text: "" });
    const out = await gen([
      seg("agent", 0, "hi there how are you today"),
      seg("customer", 1, "im good thanks"),
      seg("agent", 2, "can I show you something?"),
    ]);
    expect(out.hasSignal).toBe(true);
    expect(out.categories.map((c) => c.key)).toContain("talk_ratio");
  });

  it("never throws — an LLM error degrades to the honest empty state", async () => {
    asMock(dissectCoachV5).mockRejectedValue(new Error("provider down"));
    const out = await gen([
      seg("agent", 0, "hi there how are you today"),
      seg("customer", 1, "im good thanks"),
      seg("agent", 2, "can I show you something?"),
    ]);
    expect(out).toEqual({ hasSignal: false, categories: [] });
  });
});
