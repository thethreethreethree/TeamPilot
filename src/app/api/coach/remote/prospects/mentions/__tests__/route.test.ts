import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/remote/prospects/mentions (F20.10, 2026-11-26): for closed deals, the trackers heard on their calls —
 * read through the caller's client (no service role), open deals left out, a failed read a 500.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const st = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]>, fail: null as string | null }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "in", "order", "eq"]) q[m] = () => q;
      const res = () => (st.fail === t ? { data: null, error: { message: "boom" } } : { data: st.tables[t] ?? [], error: null });
      q.range = async (from: number) => (from > 0 ? { data: [], error: null } : res());
      q.then = (r: (v: unknown) => unknown) => r(res());
      return q;
    },
  }),
}));
vi.mock("@/lib/coach/remote/prospects", () => ({
  listProspects: vi.fn(async () => [
    { id: "p-won", status: "won" },
    { id: "p-lost", status: "lost" },
    { id: "p-open", status: "open" },
  ]),
}));

import { GET } from "../route";
const get = (q = "") => GET(new Request(`http://t/x${q}`) as never);

beforeEach(() => {
  st.fail = null;
  st.tables = {
    remote_prospect_calls: [
      { id: 1, prospect_id: "p-won", session_id: "s1" },
      { id: 2, prospect_id: "p-lost", session_id: "s2" },
    ],
    session_interaction_stats: [
      { session_id: "s1", transcript_version: 1 },
      { session_id: "s1", transcript_version: 2 },
      { session_id: "s2", transcript_version: 1 },
    ],
    tracker_hits: [
      { id: 1, session_id: "s1", tracker_id: "t-price", transcript_version: 2 },
      { id: 2, session_id: "s1", tracker_id: "t-price", transcript_version: 2 },
      { id: 3, session_id: "s2", tracker_id: "t-spec", transcript_version: 1 },
      { id: 4, session_id: "s1", tracker_id: "t-spec", transcript_version: 1 }, // an older transcript — doesn't count
    ],
    keyword_trackers: [{ id: "t-price", name: "Pricing" }, { id: "t-spec", name: "Spectrum" }],
  };
});

describe("GET /prospects/mentions", () => {
  it("names the trackers heard on each closed deal's calls, once each", async () => {
    const body = await (await get()).json();
    expect(body.mentions).toEqual({ "p-won": ["Pricing"], "p-lost": ["Spectrum"] });
    expect(body.withCalls).toEqual(["p-won", "p-lost"]);
  });
  it("a deal whose call isn't analyzed or readable has no mentions and isn't compared", async () => {
    st.tables.session_interaction_stats = [{ session_id: "s1", transcript_version: 2 }];
    const body = await (await get()).json();
    expect(body.mentions).toEqual({ "p-won": ["Pricing"] });
    expect(body.withCalls).toEqual(["p-won"]);
  });
  it("a failed hits read is a 500, never 'nothing was mentioned'", async () => {
    st.fail = "tracker_hits";
    expect((await get()).status).toBe(500);
  });
  it("an unknown rep id is a 400", async () => {
    expect((await get("?repId=nope")).status).toBe(400);
  });
});
