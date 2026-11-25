import { describe, it, expect, vi } from "vitest";

/**
 * Gong F16.9: coaching is counted by WHEN IT HAPPENED (last 30 days), not by when the call started. A manager who
 * reviews a 45-day-old call today did coaching today; a comment from 40 days ago is outside the window.
 */
const DAY = 86_400_000;
const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

// 0337: no call is hidden in these tests (the hide's own rules are tested in hidePhrases.test.ts).
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenFrom: vi.fn(async () => new Set()), hiddenInCompanyFrom: vi.fn(async () => new Set()) }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "mgr1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids) }));
vi.mock("@/lib/coach/remote/feedback", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/feedback")>()),
  // Events belong to call "old" only, so loading another call's coaching adds nothing.
  loadCoachingEvents: vi.fn(async (_a: unknown, _c: string, ids: readonly string[]) => !ids.includes("old") ? [] : [
    { kind: "comment_sent_to_rep", managerId: "m1", repId: "r1", at: new Date(iso(1)), sessionId: "old" }, // today-ish, old call → counts
    { kind: "comment_sent_to_rep", managerId: "m2", repId: "r1", at: new Date(iso(40)), sessionId: "old" }, // 40 days ago → not
    { kind: "comment_draft", managerId: "m1", repId: "r1", at: new Date(iso(1)), sessionId: "old" }, // a draft never counts
  ]),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      const filters: Array<[string, unknown]> = [];
      for (const m of ["select", "eq", "in", "order", "range", "limit"]) q[m] = () => q;
      q.gte = (col: string, v: unknown) => (filters.push([col, v]), q);
      (q as { then: unknown }).then = (res: (v: unknown) => unknown) => {
        if (table === "coaching_sessions") {
          // The calls window reaches back far enough for a 45-day-old call.
          const since = String(filters.find(([c]) => c === "started_at")?.[1]);
          const rows = [{ id: "old", agent_id: "r1", started_at: iso(45), ended_at: iso(45), audio_duration_seconds: 600 }].filter((r) => r.started_at >= since);
          return Promise.resolve(res({ data: rows, error: null }));
        }
        // A request from the last 30 days about a call outside the 180-day calls read (review 2026-11-25).
        if (table === "feedback_requests") return Promise.resolve(res({ data: [{ session_id: "ancient", requester_id: "r1", recipient_id: null, created_at: iso(2) }], error: null }));
        if (table === "profiles") return Promise.resolve(res({ data: [{ id: "r1", full_name: "Rae" }], error: null }));
        // listen_events: the read must be limited to the last 30 days (created_at).
        const since = String(filters.find(([c]) => c === "created_at")?.[1]);
        const rows = [
          { session_id: "old", listener_id: "m1", rep_id: "r1", from_ms: 0, to_ms: 400_000, created_at: iso(2) },
          { session_id: "old", listener_id: "m2", rep_id: "r1", from_ms: 0, to_ms: 600_000, created_at: iso(35) },
        ].filter((r) => r.created_at >= since);
        return Promise.resolve(res({ data: rows, error: null }));
      };
      return q;
    },
  }),
}));

import { GET } from "../route";

describe("coaching metrics count when coaching happened (F16.9)", () => {
  it("credits today's coaching on an older call, and not coaching from before the window", async () => {
    const body = await (await GET(new Request("http://t/x") as never)).json();
    expect(body.sessions).toBe(1); // the 45-day-old call is in view
    expect(body.feedbackGiven).toEqual({ m1: 1 }); // m2's comment was 40 days ago; m1's draft doesn't count
    expect(body.callsListened).toEqual({ m1: 1 }); // m1 played 400 of 600 s two days ago; m2's listen was 35 days ago
    // F16.5: the same events give the rep's row — today's comment counts; the 45-day-old call is outside 30 days.
    expect(body.byRep).toHaveLength(1);
    expect(body.byRep[0]).toMatchObject({ repId: "r1", feedback30: 1, calls30: 0, overdue: false });
    // review 2026-11-25: a request about a call outside the 180-day read has that call's coaching loaded too.
    const { loadCoachingEvents } = await import("@/lib/coach/remote/feedback");
    const asked = vi.mocked(loadCoachingEvents).mock.calls.map((c) => [...c[2]]);
    expect(asked).toContainEqual(["ancient"]); // loaded for the request, though outside the calls read

  });
});
