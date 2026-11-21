import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
const db = vi.hoisted(() => ({ calls: [] as Array<[string, string, unknown[]]>, rows: [] as unknown[], people: [] as unknown[] }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "lt", "in"]) b[m] = (...a: unknown[]) => (db.calls.push([table, m, a]), b);
      b.then = (res: (v: unknown) => unknown) => res({ data: table === "audit_log" ? db.rows : db.people, error: null });
      return b;
    },
  }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { GET } from "../route";

const get = (qs = "") => new Request(`http://x/api/coach/remote/audit${qs}`) as never;

beforeEach(() => {
  db.calls = [];
  db.rows = [];
  db.people = [];
});

describe("GET /api/coach/remote/audit", () => {
  it("a manager who is not a company admin is refused before anything is read", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue({ userId: "m", companyId: "co1", role: "staff", isAdmin: false } as never);
    expect((await GET(get())).status).toBe(403);
    expect(db.calls).toEqual([]);
  });
  it("an unknown action filter is refused", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue({ userId: "a", companyId: "co1", role: "CEO", isAdmin: true } as never);
    expect((await GET(get("?action=drop.table"))).status).toBe(400);
  });
  it("an admin reads their own company's log, newest first, with the actor's name", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue({ userId: "a", companyId: "co1", role: "CEO", isAdmin: true } as never);
    db.rows = [{ id: 9, actor_id: "m1", action: "recording.trim", object_type: "coaching_session", object_id: "s1", meta: { startMs: 0, endMs: 5000 }, created_at: "2026-11-20T10:00:00Z" }];
    db.people = [{ id: "m1", full_name: "Dana" }];
    const body = await (await GET(get("?action=recording.trim"))).json();
    expect(body.rows).toEqual([{ id: 9, at: "2026-11-20T10:00:00Z", action: "recording.trim", actorName: "Dana", objectType: "coaching_session", objectId: "s1", meta: { startMs: 0, endMs: 5000 } }]);
    expect(db.calls).toContainEqual(["audit_log", "eq", ["company_id", "co1"]]);
    expect(db.calls).toContainEqual(["audit_log", "eq", ["action", "recording.trim"]]);
    expect(db.calls).toContainEqual(["audit_log", "order", ["id", { ascending: false }]]);
  });
});
