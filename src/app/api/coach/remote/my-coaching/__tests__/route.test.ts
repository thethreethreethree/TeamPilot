import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/remote/my-coaching. Pins: the caller's own rows only (every read pinned to company + requester / rep /
 * author); answered = the inbox's own rule, counted only when answered in the last 7 days; calls without the caller's
 * note; a failed part is null, never zero.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
const hour = (h: number) => new Date(Date.now() - h * 3_600_000);
vi.mock("@/lib/coach/remote/feedback", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/feedback")>()),
  loadCoachingEvents: vi.fn(async () => [
    { kind: "comment_sent_to_rep", managerId: "m1", repId: "rep1", at: hour(2), sessionId: "s1" },
    { kind: "comment_sent_to_rep", managerId: "m1", repId: "rep1", at: hour(24 * 10), sessionId: "s2" },
  ]),
}));
const db = vi.hoisted(() => ({ eqs: [] as Array<[string, string, unknown]>, fail: new Set<string>() }));
const DATA: Record<string, Array<Record<string, unknown>>> = {
  feedback_requests: [
    { session_id: "s1", recipient_id: null, created_at: hour(5).toISOString() }, // answered 2h ago → counts
    { session_id: "s2", recipient_id: null, created_at: hour(24 * 12).toISOString() }, // answered 10 days ago → not this week
    { session_id: "s3", recipient_id: "m1", created_at: hour(1).toISOString() }, // still waiting
  ],
  coaching_sessions: [{ id: "c2", started_at: hour(3).toISOString() }, { id: "c1", started_at: hour(30).toISOString() }],
  call_notes: [{ session_id: "c1" }],
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "gte", "order", "limit", "in"]) b[m] = () => b;
      b.eq = (c: string, v: unknown) => {
        db.eqs.push([table, c, v]);
        return b;
      };
      b.then = (res: (v: unknown) => unknown) =>
        res(db.fail.has(table) ? { data: null, error: { code: "XX000", message: "boom" } } : { data: DATA[table] ?? [], error: null });
      return b;
    },
  }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { GET } from "../route";

const req = () => new Request("http://x/api/coach/remote/my-coaching") as never;
beforeEach(() => {
  db.eqs = [];
  db.fail = new Set();
});

describe("GET my-coaching", () => {
  it("401 when signed out", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(401);
  });
  it("answered this week, still waiting, and this week's calls without the caller's note — own rows only", async () => {
    const j = await (await GET(req())).json();
    expect(j).toEqual({ answers: { answered: 1, waiting: 1, newestSessionId: "s1" }, notes: { without: 1, newestSessionId: "c2" } });
    for (const t of ["feedback_requests", "coaching_sessions", "call_notes"]) expect(db.eqs).toContainEqual([t, "company_id", "co1"]);
    expect(db.eqs).toContainEqual(["feedback_requests", "requester_id", "rep1"]);
    expect(db.eqs).toContainEqual(["coaching_sessions", "agent_id", "rep1"]);
    expect(db.eqs).toContainEqual(["call_notes", "author_id", "rep1"]);
  });
  it("a failed read is null for that part only, never zero", async () => {
    db.fail.add("call_notes");
    const j = await (await GET(req())).json();
    expect(j.notes).toBeNull();
    expect(j.answers).toEqual({ answered: 1, waiting: 1, newestSessionId: "s1" });
  });
});
