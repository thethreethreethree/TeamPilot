import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * runAndStoreDissect event emission — the dissect-cron cost-loop fix (2026-08-14). The load-bearing behavior:
 *   - hasSignal            → emit coach.dissect_generated (existing).
 *   - LLM ran, no signal   → emit coach.dissect_ATTEMPTED reason "no_signal" (backoff, so the backfill stops
 *                            re-running a full LLM call on a stuck session forever).
 *   - thin (0 agent turns) → emit coach.dissect_ATTEMPTED reason "no_agent_turns". (2026-09-09 fix: the old
 *                            behavior emitted NOTHING here, so a customer-only/one-sided session carried no
 *                            backoff marker and the backfill re-selected it EVERY pass forever — cap burn +
 *                            "Generate missing" frozen above 0. The reason lets the sessions list show an
 *                            honest "One-sided" status. Recovery is via re-transcription, which regenerates
 *                            directly and bypasses this backoff, so the marker never blocks a real fix.)
 */
const captured = vi.hoisted(() => ({ inserts: [] as Array<{ kind?: string; subject?: string; payload?: unknown }> }));

vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getCurrentSalesCorpus: vi.fn(async () => null) }));
vi.mock("@/lib/coach/v5/salesDissectPrompt", () => ({ buildSalesDissectSystemPrompt: () => "SYS" }));
vi.mock("@/lib/coach/v5/salesReviewPrompt", () => ({ buildSalesReviewUserMessage: () => "USER" }));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (row: { kind?: string; subject?: string; payload?: unknown }) => {
        captured.inserts.push(row);
        return { error: null };
      },
    }),
  }),
}));

import { dissectCoachV5 } from "@/lib/claude";
import { runAndStoreDissect } from "../salesDissect";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number) => ({ id: `s${i}`, speaker, text: "x", seq: i });
const run = (segments: ReturnType<typeof seg>[]) =>
  runAndStoreDissect({ companyId: "co1", actorId: "rep1", sessionId: "sess1", segments } as Parameters<typeof runAndStoreDissect>[0]);

const dissectOk = {
  suppressed: false,
  text: JSON.stringify({
    strengths: [{ point: "clear opener", example: "you led with the offer", why: "earns trust" }],
    growthAreas: [],
    standoutStrategy: null,
    overall: "solid",
  }),
};

beforeEach(() => {
  captured.inserts = [];
  vi.clearAllMocks();
});

describe("runAndStoreDissect — event emission (cost-loop backoff)", () => {
  it("hasSignal → emits coach.dissect_generated", async () => {
    asMock(dissectCoachV5).mockResolvedValue(dissectOk);
    await run([seg("agent", 0), seg("customer", 1), seg("agent", 2)]);
    expect(captured.inserts).toHaveLength(1);
    expect(captured.inserts[0]).toMatchObject({ kind: "coach.dissect_generated", subject: "sales_session:sess1" });
  });

  it("LLM ran but NO signal (agent turns present) → emits coach.dissect_attempted (backoff marker)", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "" }); // starvation-shaped empty
    await run([seg("agent", 0), seg("customer", 1), seg("agent", 2)]);
    expect(captured.inserts).toHaveLength(1);
    expect(captured.inserts[0]).toMatchObject({ kind: "coach.dissect_attempted", subject: "sales_session:sess1" });
  });

  it("thin (0 agent turns) → emits coach.dissect_attempted reason 'no_agent_turns' (backoff, no LLM ran)", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "" });
    await run([seg("customer", 0), seg("customer", 1)]);
    expect(captured.inserts).toHaveLength(1);
    expect(captured.inserts[0]).toMatchObject({
      kind: "coach.dissect_attempted",
      subject: "sales_session:sess1",
      payload: { reason: "no_agent_turns" },
    });
    expect(dissectCoachV5).not.toHaveBeenCalled(); // short-circuited before the LLM
  });

  it("LLM ran, no signal → the attempted marker carries reason 'no_signal' (distinct from one-sided)", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "" });
    await run([seg("agent", 0), seg("customer", 1)]);
    expect(captured.inserts[0]).toMatchObject({
      kind: "coach.dissect_attempted",
      payload: { reason: "no_signal" },
    });
  });
});
