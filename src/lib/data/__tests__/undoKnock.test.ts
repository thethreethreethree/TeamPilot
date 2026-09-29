import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { undoKnock, UNDO_WINDOW_MS } from "../doorlog";

/**
 * The quiet undo (0267). The fake honours TABLE NAMES and FILTERS — the day-target tests passed unchanged when
 * their table was renamed under them, because their mocks answered whatever was asked. This one only finds a
 * knock whose id / client id AND rep match, and only accepts an undo on `door_knock_undos`.
 */
type Knock = { id: string; rep_id: string; client_knock_id: string | null; created_at: string };

function fakeDb(opts: {
  me?: string | null;
  knocks?: Knock[];
  undoError?: { code: string; message: string } | null;
  alreadyUndone?: boolean;
}) {
  const writes: Array<{ table: string; row: unknown; onConflict?: string }> = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: opts.me === null ? null : { id: opts.me ?? "rep-a" } } }) },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (col: string, v: unknown) => ((filters[col] = v), b);
      b.maybeSingle = async () => {
        if (table !== "door_knocks") return { data: null, error: null };
        const hit = (opts.knocks ?? []).find((k) =>
          Object.entries(filters).every(([c, v]) => (k as Record<string, unknown>)[c] === v)
        );
        return { data: hit ? { id: hit.id, created_at: hit.created_at } : null, error: null };
      };
      b.upsert = (row: unknown, o: { onConflict?: string }) => {
        writes.push({ table, row, onConflict: o?.onConflict });
        return {
          select: async () =>
            opts.undoError
              ? { data: null, error: opts.undoError }
              : { data: opts.alreadyUndone ? [] : [{ knock_id: (row as { knock_id: string }).knock_id }], error: null },
        };
      };
      return b;
    },
  };
  return { db: db as never, writes };
}

const fresh = (over: Partial<Knock> = {}): Knock => ({
  id: "k1", rep_id: "rep-a", client_knock_id: "c1", created_at: new Date(Date.now() - 5_000).toISOString(), ...over,
});

describe("undoKnock", () => {
  it("appends an undo for the caller's own knock, found by client id — and never touches door_knocks", async () => {
    const { db, writes } = fakeDb({ knocks: [fresh()] });
    const r = await undoKnock({ db, companyId: "co1", clientKnockId: "c1" });
    expect(r).toEqual({ ok: true, alreadyUndone: false });
    expect(writes).toEqual([
      { table: "door_knock_undos", row: { knock_id: "k1", company_id: "co1", rep_id: "rep-a" }, onConflict: "knock_id" },
    ]);
  });

  it("finds it by the server's knock id too", async () => {
    const { db } = fakeDb({ knocks: [fresh()] });
    expect((await undoKnock({ db, companyId: "co1", knockId: "k1" })).ok).toBe(true);
  });

  it("will not undo SOMEONE ELSE'S knock, even one the caller can see (a manager)", async () => {
    const { db, writes } = fakeDb({ me: "manager-m", knocks: [fresh({ rep_id: "rep-a" })] });
    expect(await undoKnock({ db, companyId: "co1", knockId: "k1" })).toEqual({ ok: false, reason: "not_found" });
    expect(writes).toHaveLength(0);
  });

  it("says too_late after the window, and writes nothing", async () => {
    const old = new Date(Date.now() - UNDO_WINDOW_MS - 60_000).toISOString();
    const { db, writes } = fakeDb({ knocks: [fresh({ created_at: old })] });
    expect(await undoKnock({ db, companyId: "co1", knockId: "k1" })).toEqual({ ok: false, reason: "too_late" });
    expect(writes).toHaveLength(0);
  });

  it("is idempotent: a second undo of the same knock is ok, not an error", async () => {
    const { db } = fakeDb({ knocks: [fresh()], alreadyUndone: true });
    expect(await undoKnock({ db, companyId: "co1", knockId: "k1" })).toEqual({ ok: true, alreadyUndone: true });
  });

  it("fails LOUD as 'unavailable' when 0267 is not applied yet, never as success", async () => {
    for (const code of ["42P01", "PGRST205"]) {
      const { db } = fakeDb({ knocks: [fresh()], undoError: { code, message: "relation does not exist" } });
      expect(await undoKnock({ db, companyId: "co1", knockId: "k1" })).toEqual({ ok: false, reason: "unavailable" });
    }
  });

  it("names nothing when it cannot tell which knock", async () => {
    const { db } = fakeDb({ knocks: [fresh()] });
    expect(await undoKnock({ db, companyId: "co1" })).toEqual({ ok: false, reason: "not_found" });
  });
});
