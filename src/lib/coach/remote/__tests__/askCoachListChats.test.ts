import { describe, it, expect, vi, beforeEach } from "vitest";

/** listChats — 0337 (F33.8): a saved chat that covers any call a company phrase hid from the asker is withheld (its
 *  answers quote the call); a failed hide check withholds them all, never shows them. */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/claude", () => ({ askCoachTurn: vi.fn(), followThroughCoach: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/pitchScore/readPitchScore", () => ({ readPitchScore: vi.fn(async () => null) }));
const hide = vi.hoisted(() => ({ ids: new Set<string>(), fail: false }));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({
  hiddenFrom: vi.fn(async (_a: unknown, ids: string[]) => {
    if (hide.fail) throw new Error("boom");
    return new Set(ids.filter((i) => hide.ids.has(i)));
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in", "contains"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) =>
        res({
          data:
            table === "ask_coach_chats"
              ? [
                  { id: "c1", title: "Just this call", session_ids: ["s1"], created_at: "2026-11-25T10:00:00Z" },
                  { id: "c2", title: "This and a hidden one", session_ids: ["s1", "s9"], created_at: "2026-11-24T10:00:00Z" },
                ]
              : [],
          error: null,
        });
      return b;
    },
  }),
}));
import { listChats } from "../askCoach";

beforeEach(() => {
  hide.ids = new Set();
  hide.fail = false;
});

describe("listChats and hidden calls (0337)", () => {
  it("withholds a chat that covers a call hidden from the asker", async () => {
    const all = (await listChats("co1", "mgr", "s1")) as { chats: Array<{ id: string }> };
    expect(all.chats.map((c) => c.id)).toEqual(["c1", "c2"]);
    hide.ids = new Set(["s9"]);
    const out = (await listChats("co1", "mgr", "s1")) as { chats: Array<{ id: string }> };
    expect(out.chats.map((c) => c.id)).toEqual(["c1"]);
  });
  it("a failed hide check: unavailable, nothing shown", async () => {
    hide.fail = true;
    expect(await listChats("co1", "mgr", "s1")).toEqual({ available: false });
  });
});
