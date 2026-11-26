import { describe, it, expect, vi, beforeEach } from "vitest";

/** F16.6 (2026-11-26): interaction alerts on calls not yet coached — against this team's own analyzed calls, on each
 *  call's current transcript; too few calls says how many more; a failed stats read is "couldn't load", never "none". */
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();
const st = vi.hoisted(() => ({ calls: 25, failStats: false }));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "mgr1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids) }));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenInCompanyFrom: vi.fn(async () => new Set()) }));
vi.mock("@/lib/coach/remote/feedback", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/feedback")>()),
  loadCoachingEvents: vi.fn(async () => []),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "range", "limit", "gte"]) q[m] = () => q;
      (q as { then: unknown }).then = (res: (v: unknown) => unknown) => {
        const ids = Array.from({ length: st.calls }, (_, i) => `c${i}`);
        if (table === "coaching_sessions")
          return Promise.resolve(res({ data: ids.map((id, i) => ({ id, agent_id: "r1", started_at: iso(1 + (i % 20)), ended_at: iso(1), audio_duration_seconds: 600, client_label: id })), error: null }));
        if (table === "profiles") return Promise.resolve(res({ data: [{ id: "r1", full_name: "Rae" }], error: null }));
        if (table === "session_interaction_stats") {
          if (st.failStats) return Promise.resolve(res({ data: null, error: { message: "boom" } }));
          const rows = ids.map((id, i) => ({ id: i + 1, session_id: id, transcript_version: 2, talk_ratio_time: id === "c0" ? 0.95 : 0.4 + (i % 10) / 100, longest_rep_monologue_ms: 30_000, interactivity: 5, patience_ms: 800 }));
          // c1's OLD transcript talked a lot; its current one doesn't — the old one must not raise an alert.
          rows.push({ id: 999, session_id: "c1", transcript_version: 1, talk_ratio_time: 0.99, longest_rep_monologue_ms: 30_000, interactivity: 5, patience_ms: 800 });
          return Promise.resolve(res({ data: rows, error: null }));
        }
        return Promise.resolve(res({ data: [], error: null }));
      };
      return q;
    },
  }),
}));

import { GET } from "../route";
const get = async () => (await GET(new Request("http://t/x") as never)).json();
beforeEach(() => {
  st.calls = 25;
  st.failStats = false;
});

describe("coaching metrics — interaction alerts (F16.6)", () => {
  it("flags the call far out from this team's calls, on its current transcript only", async () => {
    const body = await get();
    expect(body.alerts.needed).toBe(0);
    expect(body.alerts.baselineCalls).toBe(25);
    expect(body.alerts.byCall.c0).toEqual(["talked_most"]);
    expect(body.alerts.byCall.c1).toBeUndefined();
  });
  it("too few analyzed calls: no alerts, and how many more are needed", async () => {
    st.calls = 12;
    const body = await get();
    expect(body.alerts).toEqual({ baselineCalls: 12, needed: 8, byCall: {} });
  });
  it("a failed stats read is null (couldn't load), not an empty list", async () => {
    st.failStats = true;
    const body = await get();
    expect(body.alerts).toBeNull();
    expect(body.byRep[0].uncoached.length).toBe(25);
  });
});
