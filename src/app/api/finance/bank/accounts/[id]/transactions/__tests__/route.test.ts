import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/finance/bank/accounts/[id]/transactions — the reconciliation register (build xx).
 *
 * The behaviour worth pinning is the HONEST-TRUNCATION disclosure (§3.4): the register caps at max_rows (1000)
 * and, rather than silently hiding older lines, returns { total, truncated } so the UI can say "showing the most
 * recent 1,000 of N". Locks: (1) under the cap → truncated:false, total = rows returned, and NO head-count query
 * is paid for; (2) at the cap with more rows behind it → truncated:true, total = the exact head count; (3) the
 * unauth gate; (4) a read error yields the honest empty shape, not a leak.
 */
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "../route";
import { createClient } from "@/lib/supabase/server";

/** A supabase test double. The route reads the data page first (.select(cols).eq().order().limit()), then — only
 *  when that page is full — a head count (.select("id", { count, head }).eq()). We distinguish the two by the
 *  count option on select, and count how many `from()` calls happen so a test can assert the count read was
 *  skipped. */
function fakeSb(o: {
  user?: { id: string } | null;
  rows?: Array<Record<string, unknown>> | null;
  error?: { message: string } | null;
  count?: number | null;
}) {
  const state = { fromCalls: 0 };
  const sb = {
    _state: state,
    auth: {
      getUser: async () => ({ data: { user: o.user === undefined ? { id: "u1" } : o.user } }),
    },
    from: () => {
      state.fromCalls += 1;
      let isCount = false;
      const chain: Record<string, unknown> = {};
      chain.select = (_cols: unknown, opts?: { head?: boolean }) => {
        if (opts && opts.head) isCount = true;
        return chain;
      };
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve(isCount ? { count: o.count ?? null } : { data: o.rows ?? null, error: o.error ?? null });
      return chain;
    },
  };
  return sb;
}

const mock = (sb: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(sb);

const ctx = { params: Promise.resolve({ id: "acct1" }) };
const run = () => GET({} as never, ctx);

beforeEach(() => vi.clearAllMocks());

describe("GET /finance/bank/accounts/[id]/transactions — honest truncation", () => {
  it("401 when unauthenticated", async () => {
    mock(fakeSb({ user: null }));
    expect((await run()).status).toBe(401);
  });

  it("under the cap: truncated=false, total=rows, and NO head-count query is paid for", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, amount: 1 }));
    const sb = fakeSb({ rows });
    mock(sb);
    const body = await (await run()).json();
    expect(body.truncated).toBe(false);
    expect(body.total).toBe(5);
    expect(body.transactions).toHaveLength(5);
    // Only the data read happened — the count read is skipped when the page isn't full.
    expect((sb as { _state: { fromCalls: number } })._state.fromCalls).toBe(1);
  });

  it("at the cap with more behind it: truncated=true, total=the exact head count", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `t${i}`, amount: 1 }));
    const sb = fakeSb({ rows, count: 1500 });
    mock(sb);
    const body = await (await run()).json();
    expect(body.truncated).toBe(true);
    expect(body.total).toBe(1500);
    expect(body.transactions).toHaveLength(1000);
    // Two reads: the data page AND the head count.
    expect((sb as { _state: { fromCalls: number } })._state.fromCalls).toBe(2);
  });

  it("a read error yields the honest empty shape (no leak)", async () => {
    mock(fakeSb({ rows: null, error: { message: "raw pg detail" } }));
    const res = await run();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("raw pg detail");
  });
});
