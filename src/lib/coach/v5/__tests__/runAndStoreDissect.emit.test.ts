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

/**
 * The marker says WHICH no-signal (2026-09-10). `reason` keeps its two-word vocabulary because the sessions
 * list reads it; `shape` sits beside it. Measured on production: 92 of 100 declines say "no_signal", and
 * they are systematically the LONGER calls — median 683 transcript words against 341 for the ones that
 * succeeded. Thin content would be SHORT, so "no signal" is the wrong story for most of them, and until the
 * shape is stored there is no way to tell starvation from a call that genuinely had nothing to praise.
 */
describe("runAndStoreDissect — the marker records WHICH no-signal", () => {
  it("an EMPTY model response stores shape 'llm_empty' beside reason 'no_signal'", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "" });
    await run([seg("agent", 0), seg("customer", 1)]);
    expect(captured.inserts[0]).toMatchObject({
      kind: "coach.dissect_attempted",
      payload: { reason: "no_signal", shape: "llm_empty" },
    });
  });

  it("a strengths-less but VALID read stores shape 'no_strengths' — same reason, different problem", async () => {
    asMock(dissectCoachV5).mockResolvedValue({
      suppressed: false,
      text: JSON.stringify({
        strengths: [],
        growthAreas: [{ opportunity: "ask more", nextStep: "prepare two questions", why: "thin discovery" }],
        standoutStrategy: null,
      }),
    });
    await run([seg("agent", 0), seg("customer", 1)]);
    expect(captured.inserts[0]).toMatchObject({
      payload: { reason: "no_signal", shape: "no_strengths" },
    });
  });

  it("non-JSON text stores shape 'unparsable'", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "I'm sorry, I can't help." });
    await run([seg("agent", 0), seg("customer", 1)]);
    expect(captured.inserts[0]).toMatchObject({ payload: { reason: "no_signal", shape: "unparsable" } });
  });

  it("0 agent turns stores shape 'no_agent_turns', matching its reason", async () => {
    await run([seg("customer", 0)]);
    expect(captured.inserts[0]).toMatchObject({
      payload: { reason: "no_agent_turns", shape: "no_agent_turns" },
    });
  });

  it("the transcript SIZE still travels with it — the size is what turns a count into a diagnosis", async () => {
    asMock(dissectCoachV5).mockResolvedValue({ suppressed: false, text: "" });
    await run([seg("agent", 0), seg("customer", 1)]);
    const payload = captured.inserts[0]?.payload as { transcriptWords?: number; agentTurns?: number };
    expect(payload.transcriptWords).toBe(2); // one word ("x") per segment
    expect(payload.agentTurns).toBe(1);
  });
});
