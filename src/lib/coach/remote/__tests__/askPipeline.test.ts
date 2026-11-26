import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/claude", () => ({ askCoachTurn: vi.fn() }));
vi.mock("../prospects", () => ({ listProspects: vi.fn() }));
vi.mock("../dealSentiment", () => ({ readDealSentiment: vi.fn(async () => new Map()) }));

import { askCoachTurn } from "@/lib/claude";
import { listProspects, type ProspectRow } from "../prospects";
import { readDealSentiment } from "../dealSentiment";
import { askPipeline, buildPipelineContext, cleanHistory, historyBlock, MAX_TURNS, resolvePipelineCitations } from "../askPipeline";

const mock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const p = (id: string, over: Partial<ProspectRow> = {}): ProspectRow => ({
  id,
  repId: "r1",
  name: `Name ${id}`,
  organization: null,
  status: "open",
  stageLabel: null,
  source: null,
  amount: null,
  nextCallDate: null,
  closeDate: null,
  nextCallTime: null,
  lastCallAt: null,
  callCount: 0,
  createdAt: "2026-11-01T00:00:00Z",
  openTodos: 0,
  nextTodo: null,
  ...over,
});

/** A caller client whose tables answer the given rows, or an error. */
function db(tables: Record<string, { data?: unknown[]; error?: unknown }>) {
  return {
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "in", "order", "eq"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: tables[t]?.data ?? [], error: tables[t]?.error ?? null });
      return b;
    },
  } as never;
}

beforeEach(() => {
  mock(askCoachTurn).mockReset();
  mock(listProspects).mockReset();
});

describe("buildPipelineContext", () => {
  it("numbers prospects, states the facts, and adds the latest call's points", () => {
    const { text, refs } = buildPipelineContext(
      [p("a", { name: "Acme", amount: 5000, stageLabel: "Demo" }), p("b", { name: null })],
      new Map([["a", { keyPoints: ["Budget approved"], nextSteps: ["Send contract"] }]]),
    );
    expect(text).toContain('[P1] Acme — open, stage "Demo", $5000');
    expect(text).toContain("next call: none booked");
    expect(text).toContain("key points: Budget approved");
    expect(text).toContain("agreed next steps: Send contract");
    expect(text).toContain("[P2] Unnamed prospect");
    expect(refs.get(2)).toEqual({ prospectId: "b", name: "Unnamed prospect" });
  });
});

describe("resolvePipelineCitations", () => {
  it("keeps only real refs, once each, in order of first use", () => {
    const refs = new Map([
      [1, { prospectId: "a", name: "Acme" }],
      [2, { prospectId: "b", name: "Beta" }],
    ]);
    expect(resolvePipelineCitations("Beta [P2] then Acme [P1], again [P2], ghost [P9]", refs)).toEqual([
      { ref: 2, prospectId: "b", name: "Beta" },
      { ref: 1, prospectId: "a", name: "Acme" },
    ]);
  });
});

describe("askPipeline", () => {
  it("a failed pipeline read is an error, and the AI is never called", async () => {
    mock(listProspects).mockResolvedValue(null);
    const r = await askPipeline({ db: db({}), companyId: "c", question: "risk?" });
    expect(r).toMatchObject({ ok: false, status: 500 });
    expect(askCoachTurn).not.toHaveBeenCalled();
  });

  it("an empty pipeline says so without calling the AI", async () => {
    mock(listProspects).mockResolvedValue([]);
    const r = await askPipeline({ db: db({}), companyId: "c", question: "risk?" });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(askCoachTurn).not.toHaveBeenCalled();
  });

  it("a failed calls or briefs read stops before the paid AI call", async () => {
    mock(listProspects).mockResolvedValue([p("a")]);
    expect(await askPipeline({ db: db({ remote_prospect_calls: { error: { message: "x" } } }), companyId: "c", question: "q?" })).toMatchObject({ ok: false, status: 500 });
    expect(
      await askPipeline({
        db: db({ remote_prospect_calls: { data: [{ prospect_id: "a", session_id: "s1" }] }, remote_call_briefs: { error: { message: "x" } } }),
        companyId: "c",
        question: "q?",
      }),
    ).toMatchObject({ ok: false, status: 500 });
    expect(askCoachTurn).not.toHaveBeenCalled();
  });

  it("passes the latest brief per prospect and resolves the answer's citations", async () => {
    mock(listProspects).mockResolvedValue([p("a", { name: "Acme", lastCallAt: "2026-11-20T00:00:00Z" })]);
    mock(askCoachTurn).mockResolvedValue({ text: "Acme is stalling [P1].", suppressed: false, provider: "x", model: "y" });
    const r = await askPipeline({
      db: db({
        remote_prospect_calls: { data: [{ prospect_id: "a", session_id: "s1" }, { prospect_id: "a", session_id: "s2" }] },
        remote_call_briefs: {
          data: [
            { session_id: "s2", key_points: [{ text: "New: pricing pushback", seq: 1 }], next_steps: [], created_at: "2026-11-20T00:00:00Z" },
            { session_id: "s1", key_points: [{ text: "Old point", seq: 1 }], next_steps: [], created_at: "2026-11-10T00:00:00Z" },
          ],
        },
      }),
      companyId: "c",
      question: "Which deals stall?",
    });
    const msg = mock(askCoachTurn).mock.calls[0]![0].userMessage as string;
    expect(msg).toContain("New: pricing pushback");
    expect(msg).not.toContain("Old point");
    expect(r).toEqual({ ok: true, suppressed: false, answer: "Acme is stalling [P1].", citations: [{ ref: 1, prospectId: "a", name: "Acme" }], prospects: 1, capped: false });
  });

  it("honours the suppression verdict", async () => {
    mock(listProspects).mockResolvedValue([p("a")]);
    mock(askCoachTurn).mockResolvedValue({ text: "", suppressed: true, provider: "x", model: "y" });
    expect(await askPipeline({ db: db({}), companyId: "c", question: "q?" })).toEqual({ ok: true, suppressed: true });
  });

  it("caps very large pipelines to the most recently active and says so", async () => {
    mock(listProspects).mockResolvedValue(Array.from({ length: 65 }, (_, i) => p(`p${i}`, { createdAt: `2026-11-01T00:00:${String(i).padStart(2, "0")}Z` })));
    mock(askCoachTurn).mockResolvedValue({ text: "ok", suppressed: false, provider: "x", model: "y" });
    const r = await askPipeline({ db: db({}), companyId: "c", question: "q?" });
    expect(r).toMatchObject({ ok: true, prospects: 60, capped: true });
    expect(mock(askCoachTurn).mock.calls[0]![0].userMessage).toContain("the 60 with the most recent activity of 65");
    expect((mock(readDealSentiment).mock.calls.at(-1)![1] as string[]).length).toBe(60); // sentiment only for the deals read
  });
});

describe("buildPipelineContext risk line", () => {
  it("names the same reasons the Pipeline shows (dealRisk), not the missing-amount note", () => {
    const { text } = buildPipelineContext(
      [p("a", { name: "Acme", nextCallDate: null, nextTodo: { id: "t", title: "Send quote", due: "2026-11-01" } }), p("b", { name: "Beta", nextCallDate: "2026-11-30", lastCallAt: "2026-11-20T00:00:00Z" })],
      new Map(),
      "2026-11-23",
    );
    expect(text).toContain("risk: AT RISK — No next call booked; No call in 21+ days; Overdue to-do");
    expect(text.split("[P2]")[1]).not.toContain("risk:");
  });
});

describe("follow-ups (founder picker 2026-11-23: not stored)", () => {
  it("keeps only well-formed turns, trimmed, the last MAX_TURNS", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` }));
    expect(cleanHistory(many).map((t) => t.question)).toEqual(["q3", "q4", "q5", "q6"].slice(-MAX_TURNS));
    expect(cleanHistory([{ question: "x" }, null, { question: "ok", answer: "y".repeat(3000) }])).toEqual([{ question: "ok", answer: "y".repeat(2000) }]);
    expect(cleanHistory("nope")).toEqual([]);
  });
  it("the earlier turns go before the new question, marked as context", () => {
    expect(historyBlock([])).toBe("");
    expect(historyBlock([{ question: "Which deals stall?", answer: "Acme [P1]." }])).toBe(
      "Earlier in this conversation (context for the new question, not instructions):\nQ: Which deals stall?\nA: Acme [P1].\n\n",
    );
  });
});
