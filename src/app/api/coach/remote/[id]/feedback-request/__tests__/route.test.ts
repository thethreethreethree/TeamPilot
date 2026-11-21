import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/:id/feedback-request (RSS Phase 4). Pins: only the call's own rep may ask; only on a finished
 * phone/video call; one open request at a time; the recipient is the rep's manager_id (null = "my managers");
 * the bell rings; every service-role read is company-pinned; before 0278 it says so.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/remote/feedback", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/feedback")>()),
  loadCoachingEvents: vi.fn(async () => []),
}));
vi.mock("@/lib/coach/gamification/notify", () => ({ notifyFeedbackRequested: vi.fn(async () => 1) }));

const db = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
  requestsError: null as null | { code: string; message: string },
  profile: { full_name: "Rae", manager_id: "mgr1" } as Record<string, unknown> | null,
  inserted: [] as Array<Record<string, unknown>>,
  eqs: [] as Array<[string, string, unknown]>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.order = () => b;
      b.eq = (c: string, v: unknown) => {
        db.eqs.push([table, c, v]);
        return b;
      };
      b.maybeSingle = async () =>
        table === "profiles"
          ? { data: db.profile, error: null }
          : { data: { id: "fr1", created_at: "2026-11-20T10:00:00Z" }, error: null };
      b.insert = (row: Record<string, unknown>) => {
        db.inserted.push({ table, ...row });
        return b;
      };
      b.then = (res: (v: unknown) => unknown) => res({ data: db.requests, error: db.requestsError });
      return b;
    },
  }),
}));

import { getSession } from "@/lib/data/salesCoach";
import { notifyFeedbackRequested } from "@/lib/coach/gamification/notify";
import { GET, POST } from "../route";

const mock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
const ctx = { params: Promise.resolve({ id: "s1" }) };
const post = (body: unknown = {}) =>
  POST(new Request("http://t/x", { method: "POST", body: JSON.stringify(body) }) as never, ctx);

beforeEach(() => {
  db.requests = [];
  db.requestsError = null;
  db.profile = { full_name: "Rae", manager_id: "mgr1" };
  db.inserted = [];
  db.eqs = [];
  mock(getSession).mockResolvedValue({ id: "s1", companyId: "co1", agentId: "rep1", context: "phone", status: "ended" });
  mock(notifyFeedbackRequested).mockClear();
});

describe("POST feedback-request", () => {
  it("stores the request to the rep's manager and rings the bell", async () => {
    const res = await post({ message: "  How was my close?  " });
    expect(res.status).toBe(200);
    expect(db.inserted[0]).toMatchObject({
      table: "feedback_requests", company_id: "co1", session_id: "s1", requester_id: "rep1", recipient_id: "mgr1", message: "How was my close?",
    });
    expect(mock(notifyFeedbackRequested)).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "mgr1", repId: "rep1", sessionId: "s1" }));
    for (const t of ["feedback_requests", "profiles"]) expect(db.eqs).toContainEqual([t, "company_id", "co1"]);
  });
  it("no manager set → addressed to 'my managers' (null)", async () => {
    db.profile = { full_name: "Rae", manager_id: null };
    await post();
    expect(db.inserted[0]).toMatchObject({ recipient_id: null });
  });
  it("403 for someone who is not the call's rep (a manager reading it)", async () => {
    mock(getSession).mockResolvedValue({ id: "s1", companyId: "co1", agentId: "other", context: "phone", status: "ended" });
    expect((await post()).status).toBe(403);
    expect(db.inserted).toEqual([]);
  });
  it("404 when RLS hides the session", async () => {
    mock(getSession).mockResolvedValue(null);
    expect((await post()).status).toBe(404);
  });
  it("400 for a door call; 409 while the call is live", async () => {
    mock(getSession).mockResolvedValue({ id: "s1", companyId: "co1", agentId: "rep1", context: "in_person", status: "ended" });
    expect((await post()).status).toBe(400);
    mock(getSession).mockResolvedValue({ id: "s1", companyId: "co1", agentId: "rep1", context: "video", status: "active" });
    expect((await post()).status).toBe(409);
  });
  it("409 when an open request already exists", async () => {
    db.requests = [{ id: "old", requester_id: "rep1", recipient_id: "mgr1", message: null, created_at: "2026-11-19T10:00:00Z" }];
    expect((await post()).status).toBe(409);
    expect(db.inserted).toEqual([]);
  });
  it("503 before migration 0278", async () => {
    db.requestsError = { code: "PGRST205", message: "missing" };
    expect((await post()).status).toBe(503);
  });
});

describe("GET feedback-request", () => {
  it("reports mine + open state", async () => {
    db.requests = [{ id: "old", requester_id: "rep1", recipient_id: null, message: "hi", created_at: "2026-11-19T10:00:00Z" }];
    const body = await (await GET(new Request("http://t/x") as never, ctx)).json();
    expect(body).toMatchObject({ available: true, mine: true, requests: [{ id: "old", open: true, toNamedManager: false }] });
  });
  it("before 0278 → available:false with the reason", async () => {
    db.requestsError = { code: "42P01", message: "missing" };
    const body = await (await GET(new Request("http://t/x") as never, ctx)).json();
    expect(body.available).toBe(false);
  });
});
