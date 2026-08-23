import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Prep-up data-layer honesty (audit 2026-08-23). Two sharp bugs: markMeetingPrepStarted returned true even when it
 * linked 0 rows (a stale/foreign prepId → agenda-less meeting reported as "prep loaded"); and getMeetingPrep
 * collapsed a real DB error to null → a false 404 "prep not found". Locks both.
 */
const state = vi.hoisted(() => ({ result: { data: null as unknown, error: null as { message: string } | null } }));

// A chainable query builder whose terminal call (.select(...) after update, or .maybeSingle()) resolves to state.result.
function makeClient() {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "update", "eq", "insert", "order"]) chain[m] = () => chain;
  chain.select = () => ({ ...chain, then: (r: (v: unknown) => void) => r(state.result) }); // update().select() awaits here
  chain.maybeSingle = async () => state.result;
  chain.single = async () => state.result;
  return { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) }, from: () => chain };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeClient() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => makeClient() }));

import { markMeetingPrepStarted, getMeetingPrep } from "../meetingPrep";

beforeEach(() => {
  state.result = { data: null, error: null };
});

describe("markMeetingPrepStarted — reports the REAL link result (audit INT-3)", () => {
  it("returns FALSE when the update matched 0 rows (stale/foreign prepId — no error, no link)", async () => {
    state.result = { data: [], error: null }; // update matched nothing
    expect(await markMeetingPrepStarted({ prepId: "stale", sessionId: "s1" })).toBe(false);
  });
  it("returns TRUE only when a row was actually linked", async () => {
    state.result = { data: [{ id: "p1" }], error: null };
    expect(await markMeetingPrepStarted({ prepId: "p1", sessionId: "s1" })).toBe(true);
  });
  it("returns FALSE on a DB error (never a false success)", async () => {
    state.result = { data: null, error: { message: "conn reset" } };
    expect(await markMeetingPrepStarted({ prepId: "p1", sessionId: "s1" })).toBe(false);
  });
});

describe("getMeetingPrep — error is not a false 404 (audit: error-as-no-data)", () => {
  it("THROWS on a genuine DB error (so the route 500s, not 404 'not found')", async () => {
    state.result = { data: null, error: { message: "timeout" } };
    await expect(getMeetingPrep("p1")).rejects.toThrow(/getMeetingPrep failed/);
  });
  it("returns null for a real no-row (genuine not-found / not-owner)", async () => {
    state.result = { data: null, error: null };
    expect(await getMeetingPrep("missing")).toBeNull();
  });
});
