import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/claude", () => ({ askCoachTurn: vi.fn(), followThroughCoach: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
const saved = vi.hoisted(() => ({ rows: [] as Array<{ table: string; row: unknown }> }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in", "contains"]) b[m] = () => b;
      b.insert = (row: unknown) => {
        saved.rows.push({ table, row });
        return b;
      };
      b.maybeSingle = async () => ({ data: table === "ask_coach_chats" ? { id: "ch1" } : null, error: null });
      b.then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
      return b;
    },
  }),
}));

import { askCoachTurn } from "@/lib/claude";
import { getSession } from "@/lib/data/salesCoach";
import { askCoach, numberAcross, resolveCitations } from "../askCoach";

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
  it("empty answer, not suppressed → 502 (never a blank answer)", async () => {
    mock(askCoachTurn).mockResolvedValue({ text: "  ", suppressed: false });
    expect(await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null })).toMatchObject({ ok: false, status: 502 });
  });
  it("suppressed → the intended no-answer, nothing saved", async () => {
    mock(askCoachTurn).mockResolvedValue({ text: "", suppressed: true });
    expect(await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null })).toMatchObject({ ok: true, suppressed: true });
    expect(saved.rows).toEqual([]);
  });
  it("a call the caller cannot open is refused, not skipped", async () => {
    mock(getSession).mockResolvedValueOnce(null);
    expect(await askCoach({ db: callerDb, companyId: "co1", userId: "u1", sessionIds: ["s1"], question: "price?", chatId: null })).toMatchObject({ ok: false, status: 404 });
    expect(mock(askCoachTurn)).not.toHaveBeenCalled();
  });
});
