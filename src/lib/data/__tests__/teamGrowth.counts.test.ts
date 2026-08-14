import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * fetchTeamGrowth pure-count reads must use a server-side EXACT head count, not `.select().length` (which
 * PostgREST silently caps at 1000, under-reporting an active team's growth past 1000/window — audit 2026-08-14).
 * This locks it: the snapshot's counts come from the query `.count`, and would be 0 (a reverted `.data.length`
 * on a head:true query returns null data) if someone reverted to the unbounded read.
 */

// Per-table results: a `head:true` read returns { count }, a value read returns { data: rows }.
const COUNT_BY_TABLE: Record<string, number> = {
  profiles: 3, // agents
  support_resolutions: 5, // resolutions
  support_conversations: 7, // claimed + awaiting (both head-counts on this table)
  support_messages: 11, // agentReplies (head-count); coach_counts is a value read (see below)
};
const ROWS_BY_TABLE: Record<string, unknown[]> = {
  support_durability_checks: [{ outcome: "held" }, { outcome: "reopened" }],
  support_ai_co_pilot_edits: [{ edit_magnitude: "minor" }],
  support_messages: [{ coach_counts: { positive: { acknowledged: 1 } } }], // value read (head:false)
};

vi.mock("@/lib/supabase/server", () => {
  // The CLIENT is not thenable — only the per-table QUERY builder is (so `await createClient()` returns the
  // client, and each `.from(...).select()...` is awaited as a query).
  const makeQuery = (table: string) => {
    const b: Record<string, unknown> = { _head: false };
    b.select = (_cols: string, opts?: { head?: boolean }) => {
      if (opts?.head) (b as { _head: boolean })._head = true;
      return b;
    };
    for (const m of ["eq", "or", "in", "not", "gte"]) b[m] = () => b;
    b.then = (resolve: (v: unknown) => void) => {
      if ((b as { _head: boolean })._head) {
        resolve({ count: COUNT_BY_TABLE[table] ?? 0, data: null, error: null });
      } else {
        resolve({ data: ROWS_BY_TABLE[table] ?? [], error: null });
      }
    };
    return b;
  };
  const client = { from: (t: string) => makeQuery(t) };
  return { createClient: async () => client };
});

import { fetchTeamGrowth } from "../care";

beforeEach(() => vi.clearAllMocks());

describe("fetchTeamGrowth — counts via exact head count (no 1000 cap)", () => {
  it("reads the pure counts from query .count (head:true), not .data.length", async () => {
    const snap = await fetchTeamGrowth("co1");
    expect(snap.agentCount).toBe(3); // profiles head count
    expect(snap.resolutions).toBe(5); // support_resolutions head count
    expect(snap.presence.conversationsClaimed).toBe(7); // support_conversations head count
    expect(snap.presence.awaitingResponse).toBe(7);
    expect(snap.presence.repliesSent).toBe(11); // support_messages agentReplies head count
    // The VALUE reads still return rows (durability/edits/coach) — proves the two paths coexist.
    expect(snap.durabilityHeld).toBe(1);
    expect(snap.durabilityReopened).toBe(1);
    expect(snap.copilotMinor).toBe(1);
    expect(snap.coachAggregate.acknowledgedCount).toBe(1);
  });
});
