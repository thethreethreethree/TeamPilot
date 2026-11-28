import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/claude", () => ({ askCoachTurn: vi.fn(), followThroughCoach: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/pitchScore/readPitchScore", () => ({ readPitchScore: vi.fn(async () => null) }));
const saved = vi.hoisted(() => ({ rows: [] as Array<{ table: string; row: unknown }>, turnsFail: false }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in", "contains"]) b[m] = () => b;
      b.insert = (row: unknown) => {
        saved.rows.push({ table, row });
        return b;
      };
      b.maybeSingle = async () => ({ data: table === "ask_coach_chats" ? { id: "ch1", session_ids: ["s1"] } : null, error: null });
      b.then = (res: (v: unknown) => unknown) =>
        res(table === "ask_coach_turns" && saved.turnsFail ? { data: null, error: { message: "boom" } } : { data: [], error: null });
      return b;
    },
  }),
}));

import { askCoachTurn } from "@/lib/claude";
import { getSession } from "@/lib/data/salesCoach";
import { readPitchScore } from "@/lib/coach/pitchScore/readPitchScore";
import { askCoach, askCoachDeep, keepLines, numberAcross, renumber, resolveCitations, scorecardText } from "../askCoach";

const mock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const callerDb = {
  from: () => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "range"]) b[m] = () => b;
    b.then = (res: (v: unknown) => unknown) =>
      res({
        data: [
          { seq: 1, speaker: "rep", text: "Hi", spoken_at: "2026-11-20T10:00:00Z", version: 1 },
          { seq: 2, speaker: "customer", text: "Too pricey", spoken_at: "2026-11-20T10:00:30Z", version: 1 },
        ],
        error: null,
      });
    return b;
  },
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  saved.rows = [];
  saved.turnsFail = false;
  mock(getSession).mockResolvedValue({ id: "s1", sessionKind: "sales", startedAt: "2026-11-20T10:00:00Z", clientLabel: "Acme" });
});

describe("numberAcross / resolveCitations", () => {
  it("numbers lines across calls and resolves only real refs, deduplicated", () => {
    const { text, refs } = numberAcross([
      { sessionId: "a", label: "A", lines: [{ seq: 1, speaker: "rep", text: "x", atMs: 0 }] },
      { sessionId: "b", label: "B", lines: [{ seq: 7, speaker: "customer", text: "y", atMs: 5000 }] },
    ]);
    expect(text).toContain("[2] CUSTOMER: y");
    expect(resolveCitations("see [2] and [2] and [9]", refs)).toEqual([{ ref: 2, sessionId: "b", seq: 7, atMs: 5000 }]);
  });
});

describe("askCoach", () => {
  it("answers with resolved citations and saves the chat and both turns", async () => {
    mock(askCoachTurn).mockResolvedValue({ text: "Price came up here [2].", suppressed: false });
    const r = await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null });
    expect(r).toMatchObject({ ok: true, chatId: "ch1", citations: [{ ref: 2, sessionId: "s1", seq: 2, atMs: 30_000 }] });
    expect(saved.rows.map((x) => x.table)).toEqual(["ask_coach_chats", "ask_coach_turns"]);
  });
  it("save: false (E9 on-demand agents) → the same answer and citations, nothing stored", async () => {
    mock(askCoachTurn).mockResolvedValue({ text: "Price came up here [2].", suppressed: false });
    const r = await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null, save: false });
    expect(r).toMatchObject({ ok: true, chatId: null, answer: "Price came up here [2].", citations: [{ ref: 2, sessionId: "s1" }] });
    expect(saved.rows).toEqual([]);
  });
  it("empty answer, not suppressed → 502 (never a blank answer)", async () => {
    mock(askCoachTurn).mockResolvedValue({ text: "  ", suppressed: false });
    expect(await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null })).toMatchObject({ ok: false, status: 502 });
  });
  it("suppressed → the intended no-answer, nothing saved", async () => {
    mock(askCoachTurn).mockResolvedValue({ text: "", suppressed: true });
    expect(await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null })).toMatchObject({ ok: true, suppressed: true });
    expect(saved.rows).toEqual([]);
  });
  // 2026-11-23: failed reads stop BEFORE the paid AI call — never "no transcript", never an answer out of context.
  it("a transcript that fails to read is 'try again' — not 'no transcript', and no AI call", async () => {
    const failingDb = {
      from: () => {
        const b: Record<string, unknown> = {};
        for (const m of ["select", "eq", "order", "limit", "range"]) b[m] = () => b;
        b.then = (res: (v: unknown) => unknown) => res({ data: null, error: { message: "boom" } });
        return b;
      },
    } as never;
    const r = await askCoach({ db: failingDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null });
    expect(r).toMatchObject({ ok: false, status: 500 });
    expect(JSON.stringify(r)).not.toMatch(/no transcript/i);
    expect(mock(askCoachTurn)).not.toHaveBeenCalled();
  });
  it("a continued chat whose earlier turns can't be read is 'try again', and no AI call", async () => {
    saved.turnsFail = true;
    const r = await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "and then?", chatId: "ch1" });
    expect(r).toMatchObject({ ok: false, status: 500 });
    expect(mock(askCoachTurn)).not.toHaveBeenCalled();
  });
  it("a call the caller cannot open is refused, not skipped", async () => {
    mock(getSession).mockResolvedValueOnce(null);
    expect(await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null })).toMatchObject({ ok: false, status: 404 });
    expect(mock(askCoachTurn)).not.toHaveBeenCalled();
  });
});

// A16 (audit 2026-11-21): Ask Coach reads the call's stored scorecard, so it cannot silently contradict the grades the
// rep sees on screen.
const pitch = {
  total: 52, band: "Solid", qualifying: true, notQualifyingReason: null,
  elements: [
    { label: "Handles the price objection", grade: "missed", evidence: "Customer said too pricey; rep moved on" },
    { label: "Opens with a question", grade: "hit", evidence: null },
  ],
  overrides: [{ itemLabel: "Opens with a question", oldValue: "partial", newValue: "hit", reason: "Asked at 0:04" }],
} as never;

describe("scorecard composition (A16)", () => {
  it("scorecardText: total, every grade with its evidence, and manager corrections", () => {
    const t = scorecardText("Acme (2026-11-20)", pitch);
    expect(t).toContain("52 points (Solid)");
    expect(t).toContain('- Handles the price objection: missed — "Customer said too pricey; rep moved on"');
    expect(t).toContain("- manager corrected Opens with a question: partial → hit (Asked at 0:04)");
  });
  it("unscored and unreadable are told apart (a failed read is never 'not scored')", () => {
    expect(scorecardText("A", null)).toContain("not scored");
    expect(scorecardText("A", "unreadable")).toContain("could not be read");
  });
  it("the scorecard reaches the model beside the transcript, read on the caller's client", async () => {
    mock(readPitchScore).mockResolvedValueOnce(pitch);
    mock(askCoachTurn).mockResolvedValue({ text: "Price [2].", suppressed: false });
    await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null });
    expect(mock(readPitchScore)).toHaveBeenCalledWith("s1", callerDb);
    const msg = mock(askCoachTurn).mock.calls[0]![0].userMessage as string;
    expect(msg).toContain("Handles the price objection: missed");
    expect(mock(askCoachTurn).mock.calls[0]![0].systemPrompt).toContain("Do not silently contradict it");
  });
  it("a failed scorecard read still answers, and tells the model the read failed", async () => {
    mock(readPitchScore).mockRejectedValueOnce(new Error("db down"));
    mock(askCoachTurn).mockResolvedValue({ text: "Price [2].", suppressed: false });
    const r = await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null });
    expect(r).toMatchObject({ ok: true });
    expect(mock(askCoachTurn).mock.calls[0]![0].userMessage).toContain("could not be read");
  });
});

describe("keepLines (review 2026-11-28: battlecards read where the competitor came up)", () => {
  const lines = Array.from({ length: 100 }, (_, i) => ({ seq: i + 1, speaker: "customer", text: i === 60 ? "We use Spectrum now" : `line ${i}`, atMs: i * 1000 }));
  it("with a focus word, keeps the lines around its mention; without one, the opening", () => {
    const around = keepLines(lines as never, 20, ["spectrum"]);
    expect(around.around).toBe(true);
    expect(around.lines.map((l) => l.seq)).toEqual([55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67]);
    expect(keepLines(lines as never, 20).lines.map((l) => l.seq).slice(0, 3)).toEqual([1, 2, 3]);
    // never mentioned → the opening, said as such
    expect(keepLines(lines as never, 20, ["comcast"]).around).toBe(false);
    // short enough → every line
    expect(keepLines(lines.slice(0, 10) as never, 20, ["spectrum"]).lines).toHaveLength(10);
  });
});

describe("deep Ask (E18; Gong F13.12)", () => {
  it("renumber: each batch's cited lines get unique numbers; a bracket that isn't a citation stays as text", () => {
    const r = renumber("Price came up [2], then [5] and in [2024].", [{ ref: 2, sessionId: "a", seq: 2, atMs: 0 }, { ref: 5, sessionId: "b", seq: 7, atMs: null }], 11);
    expect(r.text).toBe("Price came up [11], then [12] and in (2024).");
    expect(r.refs.map((c) => [c.ref, c.sessionId])).toEqual([[11, "a"], [12, "b"]]);
  });
  it("reads 10 calls at a time and combines, keeping the batches' citations; nothing saved", async () => {
    mock(getSession).mockImplementation(async (id: string) => ({ id, sessionKind: "sales", startedAt: "2026-11-20T10:00:00Z", audioStartedAt: null, clientLabel: id }));
    // Batches run at once, so each fake answer is chosen by what the request holds, not by call order.
    mock(askCoachTurn).mockImplementation(async (a: { userMessage: string }) =>
      a.userMessage.includes("Partial answers") ? { text: "Both batches: price [1] and [2].", suppressed: false }
      : a.userMessage.includes("Call: s0 (") ? { text: "Batch one says price [2].", suppressed: false }
      : { text: "Batch two says price too [1].", suppressed: false });
    const ids = Array.from({ length: 15 }, (_, i) => `s${i}`);
    const r = await askCoachDeep({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ids, question: "price?" });
    expect(r).toMatchObject({ ok: true, batches: 2, answer: "Both batches: price [1] and [2]." });
    expect((r as { citations: Array<{ ref: number }> }).citations.map((c) => c.ref)).toEqual([1, 2]);
    expect(mock(askCoachTurn)).toHaveBeenCalledTimes(3);
    expect(String(mock(askCoachTurn).mock.calls[2]![0].userMessage)).toMatch(/=== Batch 1 ===\nBatch one says price \[1\]\.[\s\S]*=== Batch 2 ===\nBatch two says price too \[2\]\./);
    expect(saved.rows).toEqual([]);
  });
  it("10 or fewer, or more than 50 → 400; the AI off in any batch → suppressed", async () => {
    expect(await askCoachDeep({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["a", "b"], question: "q?" })).toMatchObject({ ok: false, status: 400 });
    expect(await askCoachDeep({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: Array.from({ length: 51 }, (_, i) => `x${i}`), question: "q?" })).toMatchObject({ ok: false, status: 400 });
    mock(getSession).mockImplementation(async (id: string) => ({ id, sessionKind: "sales", startedAt: "2026-11-20T10:00:00Z", audioStartedAt: null, clientLabel: id }));
    mock(askCoachTurn).mockResolvedValueOnce({ text: "", suppressed: true });
    expect(await askCoachDeep({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: Array.from({ length: 12 }, (_, i) => `y${i}`), question: "q?" })).toMatchObject({ ok: true, suppressed: true });
  });
  it("a call that can't be opened is skipped and counted before any AI call (review 2026-11-28)", async () => {
    mock(getSession).mockImplementation(async (id: string) => (id === "gone" ? null : { id, sessionKind: id === "meet" ? "meeting" : "sales", startedAt: "2026-11-20T10:00:00Z", audioStartedAt: null, clientLabel: id }));
    mock(askCoachTurn).mockResolvedValue({ text: "Budget is tight [1].", suppressed: false });
    const ids = ["gone", "meet", ...Array.from({ length: 10 }, (_, i) => `z${i}`)];
    const r = await askCoachDeep({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ids, question: "budget?" });
    expect(r).toMatchObject({ ok: true, skipped: 2, batches: 1, answer: "Budget is tight [1]." });
  });
});
