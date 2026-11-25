import { describe, it, expect, vi, beforeEach } from "vitest";

/** 0337 (F33.8): a call a company phrase hid from this manager is left out of coaching metrics — the count, the rep's
 *  uncoached calls, and requests about it — so no number or list points at a call they can't open. */
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();
const hide = vi.hoisted(() => ({ ids: new Set<string>(), fail: false }));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "mgr1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids) }));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({
  hiddenInCompanyFrom: vi.fn(async () => {
    if (hide.fail) throw new Error("boom");
    return hide.ids;
  }),
}));
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
        if (table === "coaching_sessions")
          return Promise.resolve(res({ data: [
            { id: "secret", agent_id: "r1", started_at: iso(2), ended_at: iso(2), audio_duration_seconds: 600, client_label: "Hidden Co" },
            { id: "open", agent_id: "r1", started_at: iso(3), ended_at: iso(3), audio_duration_seconds: 600, client_label: "Open Co" },
          ], error: null }));
        if (table === "feedback_requests") return Promise.resolve(res({ data: [{ session_id: "secret", requester_id: "r1", recipient_id: null, created_at: iso(1) }], error: null }));
        if (table === "profiles") return Promise.resolve(res({ data: [{ id: "r1", full_name: "Rae" }], error: null }));
        return Promise.resolve(res({ data: [], error: null }));
      };
      return q;
    },
  }),
}));

import { GET } from "../route";
beforeEach(() => {
  hide.ids = new Set();
  hide.fail = false;
});

describe("coaching metrics leave out hidden calls (0337)", () => {
  it("counts and lists only the calls this manager may open", async () => {
    const all = await (await GET(new Request("http://t/x") as never)).json();
    expect(all.sessions).toBe(2);
    expect(JSON.stringify(all)).toContain("Hidden Co"); // before the hide, it is listed as uncoached
    hide.ids = new Set(["secret"]);
    const body = await (await GET(new Request("http://t/x") as never)).json();
    expect(body.sessions).toBe(1);
    expect(JSON.stringify(body)).not.toContain("Hidden Co");
    expect(JSON.stringify(body)).not.toContain("secret");
  });
  it("a failed hide check is a 500, not numbers that might include a hidden call", async () => {
    hide.fail = true;
    expect((await GET(new Request("http://t/x") as never)).status).toBe(500);
  });
});
