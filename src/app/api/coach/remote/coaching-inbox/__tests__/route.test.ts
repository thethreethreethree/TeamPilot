import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/remote/coaching-inbox (RSS Phase 4). Pins: managers only; requests from reps outside the caller's
 * reporting tree are dropped (treeFilterReps); open/answered is derived from coaching events; "you played" merges
 * the caller's own listen ranges; every service-role read is company-pinned.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "mgr1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids.filter((i) => i !== "outside")) }));
vi.mock("@/lib/coach/remote/feedback", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/feedback")>()),
  loadCoachingEvents: vi.fn(async () => [
    { kind: "comment_sent_to_rep", managerId: "mgr1", repId: "rep2", at: new Date("2026-11-20T12:00:00Z"), sessionId: "s2" },
  ]),
}));
const hide = vi.hoisted(() => ({ ids: new Set<string>(), fail: false }));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({
  hiddenFrom: vi.fn(async (_a: unknown, ids: string[]) => {
    if (hide.fail) throw new Error("boom");
    return new Set(ids.filter((i) => hide.ids.has(i)));
  }),
}));
const db = vi.hoisted(() => ({ eqs: [] as Array<[string, string, unknown]> }));
const recent = new Date(Date.now() - 3_600_000).toISOString();
const DATA: Record<string, Array<Record<string, unknown>>> = {
  feedback_requests: [
    { id: "a", session_id: "s1", requester_id: "rep1", recipient_id: null, message: "close?", created_at: recent },
    { id: "b", session_id: "s2", requester_id: "rep2", recipient_id: "mgr1", message: null, created_at: "2026-11-20T09:00:00Z" },
    { id: "c", session_id: "s3", requester_id: "outside", recipient_id: null, message: null, created_at: recent },
  ],
  coaching_sessions: [
    { id: "s1", client_label: "Acme", context: "phone", started_at: recent },
    { id: "s2", client_label: "Beta", context: "video", started_at: recent },
  ],
  profiles: [{ id: "rep1", full_name: "Rae" }, { id: "rep2", full_name: "Sam" }],
  listen_events: [
    { session_id: "s1", from_ms: 0, to_ms: 30_000 },
    { session_id: "s1", from_ms: 10_000, to_ms: 40_000 },
  ],
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
      b.then = (res: (v: unknown) => unknown) => res({ data: DATA[table] ?? [], error: null });
      // Paged reads (2026-11-26: the inbox reads every request, then filters): one page, then empty.
      b.range = async (from: number) => ({ data: from > 0 ? [] : DATA[table] ?? [], error: null });
      return b;
    },
  }),
}));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET } from "../route";

const mock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => {
  db.eqs = [];
  hide.ids = new Set();
  hide.fail = false;
});

describe("GET coaching-inbox", () => {
  it("403 for a non-manager", async () => {
    mock(requireSalesCoachManager).mockResolvedValueOnce(null);
    expect((await GET(new Request("http://t/x") as never)).status).toBe(403);
  });
  it("rows for reps in the tree, with derived status and merged listening", async () => {
    const body = await (await GET(new Request("http://t/x") as never)).json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["a", "b"]);
    const [a, b] = body.items;
    expect(a).toMatchObject({ repName: "Rae", callLabel: "Acme", context: "phone", open: true, toYou: true, toNamedManager: false, youListenedSeconds: 40 });
    expect(b).toMatchObject({ repName: "Sam", open: false, toYou: true, toNamedManager: true, youListenedSeconds: 0 });
    for (const t of ["feedback_requests", "coaching_sessions", "profiles", "listen_events"]) {
      expect(db.eqs).toContainEqual([t, "company_id", "co1"]);
    }
  });
  it("a request about a call a company phrase hid from this manager leaves the inbox (0337)", async () => {
    hide.ids = new Set(["s1"]);
    const body = await (await GET(new Request("http://t/x") as never)).json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["b"]);
  });
  it("a failed hide check is a 500, not an inbox that might name a hidden call (0337)", async () => {
    hide.fail = true;
    expect((await GET(new Request("http://t/x") as never)).status).toBe(500);
  });
});

describe("GET coaching-inbox — other teams' requests can't push yours out (2026-11-26)", () => {
  it("400 newer requests from outside the tree: this manager's rep's older request is still listed", async () => {
    const saved = DATA.feedback_requests ?? [];
    const newer = Array.from({ length: 400 }, (_, k) => ({ id: `x${k}`, session_id: "s3", requester_id: "outside", recipient_id: null, message: null, created_at: new Date(Date.now() - k * 1000).toISOString() }));
    DATA.feedback_requests = [...newer, saved[1]!];
    try {
      const body = await (await GET(new Request("http://t/x") as never)).json();
      expect(body.items.map((i: { id: string }) => i.id)).toEqual(["b"]);
      expect(body.truncated).toBe(false);
    } finally {
      DATA.feedback_requests = saved;
    }
  });
});

