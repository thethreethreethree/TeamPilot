import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * fetchCareCommandStats — function-level lock for the phantom-status fix.
 *
 * The bug lived IN this function: openCount filtered ["new","open","assigned",
 * "waiting"] (3 non-existent statuses → collapsed to just 'open') and
 * awaitingFirstReplyCount filtered status='new' (→ permanently 0). The constant
 * test pins the VALUES; this pins that the FUNCTION's probes actually use them —
 * so a regression that re-hardcodes a phantom status here fails, even though the
 * constants stay correct.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchCareCommandStats, OPEN_CONVERSATION_STATUSES } from "../care";

type Counts = { total: number; open: number; guidance: number; new: number; durability: number };
type Calls = { in: { col: string; vals: unknown }[]; eq: { col: string; val: unknown }[] };

/** Chainable supabase-builder stub. Each `.from()` gets fresh state; the resolved
 *  count is picked from which filters were applied, mirroring the 5 probes. */
function makeSb(counts: Counts, calls: Calls) {
  return {
    from(table: string) {
      const state = { table, hasIn: false, hasEq: false, hasNot: false };
      const resolve = () => {
        if (table === "support_durability_checks") return { count: counts.durability, error: null };
        if (state.hasNot) return { count: counts.guidance, error: null };
        if (state.hasIn) return { count: counts.open, error: null };
        if (state.hasEq) return { count: counts.new, error: null };
        return { count: counts.total, error: null };
      };
      const awaitable = () => ({ then: (r: (v: unknown) => void) => r(resolve()) });
      const b: Record<string, unknown> = {
        select: () => b,
        is: () => b,
        not: () => { state.hasNot = true; return b; },
        neq: () => awaitable(),
        lte: () => awaitable(),
        in: (col: string, vals: unknown) => { state.hasIn = true; calls.in.push({ col, vals }); return awaitable(); },
        eq: (col: string, val: unknown) => { state.hasEq = true; calls.eq.push({ col, val }); return awaitable(); },
        then: (r: (v: unknown) => void) => r(resolve()), // bare select (totalProbe)
      };
      return b;
    },
  };
}

const PHANTOM = ["new", "assigned", "waiting"];

function mock(counts: Counts, calls: Calls) {
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(makeSb(counts, calls));
}

beforeEach(() => vi.clearAllMocks());

describe("fetchCareCommandStats probe filters", () => {
  it("openCount probe filters the 3 REAL open statuses (not the phantom ones)", async () => {
    const calls: Calls = { in: [], eq: [] };
    mock({ total: 10, open: 7, guidance: 2, new: 3, durability: 1 }, calls);
    const stats = await fetchCareCommandStats();

    expect(stats?.openCount).toBe(7);
    // the .in("status", ...) filter used the real open set
    const statusIn = calls.in.find((c) => c.col === "status");
    expect(statusIn?.vals).toEqual(OPEN_CONVERSATION_STATUSES);
    expect(statusIn?.vals).toEqual(["open", "in_conversation", "awaiting_customer"]);
  });

  it("awaitingFirstReply probe filters status='open' (not the non-existent 'new')", async () => {
    const calls: Calls = { in: [], eq: [] };
    mock({ total: 10, open: 7, guidance: 2, new: 3, durability: 1 }, calls);
    const stats = await fetchCareCommandStats();

    expect(stats?.awaitingFirstReplyCount).toBe(3);
    const statusEq = calls.eq.find((c) => c.col === "status");
    expect(statusEq?.val).toBe("open");
  });

  it("NO probe references a phantom status (new/assigned/waiting)", async () => {
    const calls: Calls = { in: [], eq: [] };
    mock({ total: 10, open: 7, guidance: 2, new: 3, durability: 1 }, calls);
    await fetchCareCommandStats();

    for (const c of calls.eq) expect(PHANTOM).not.toContain(c.val);
    for (const c of calls.in) {
      if (Array.isArray(c.vals)) for (const v of c.vals) expect(PHANTOM).not.toContain(v);
    }
  });

  it("returns the other counts and hasActivity", async () => {
    const calls: Calls = { in: [], eq: [] };
    mock({ total: 10, open: 7, guidance: 2, new: 3, durability: 1 }, calls);
    const stats = await fetchCareCommandStats();
    expect(stats?.hasActivity).toBe(true);
    expect(stats?.needsGuidanceCount).toBe(2);
    expect(stats?.dueDurabilityCount).toBe(1);
  });

  it("no activity → early zero return (total=0)", async () => {
    const calls: Calls = { in: [], eq: [] };
    mock({ total: 0, open: 0, guidance: 0, new: 0, durability: 0 }, calls);
    const stats = await fetchCareCommandStats();
    expect(stats?.hasActivity).toBe(false);
    expect(stats?.openCount).toBe(0);
  });
});
