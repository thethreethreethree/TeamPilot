import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/remote/:id/listen (RSS Phase 4). Pins: the listener is stamped from auth, the rep from the
 * session the caller's RLS returned; bad ranges are refused; a hidden session is a 404; before 0278 a quiet 204.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "mgr1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
const db = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, error: null as null | { code: string; message: string } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        db.rows.push(row);
        return { error: db.error };
      },
    }),
  }),
}));

import { getSession } from "@/lib/data/salesCoach";
import { POST } from "../route";

const mock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
const post = (body: unknown) =>
  POST(new Request("http://t/x", { method: "POST", body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: "s1" }) });

beforeEach(() => {
  db.rows = [];
  db.error = null;
  mock(getSession).mockResolvedValue({ id: "s1", companyId: "co1", agentId: "rep1" });
});

describe("POST listen", () => {
  it("records the range with listener from auth and rep from the session", async () => {
    const res = await post({ fromMs: 1000, toMs: 9000, listenerId: "spoofed" });
    expect(res.status).toBe(204);
    expect(db.rows).toEqual([{ company_id: "co1", session_id: "s1", listener_id: "mgr1", rep_id: "rep1", from_ms: 1000, to_ms: 9000 }]);
  });
  it("400 for a backward range", async () => {
    expect((await post({ fromMs: 9000, toMs: 1000 })).status).toBe(400);
  });
  it("404 when the caller cannot see the session", async () => {
    mock(getSession).mockResolvedValue(null);
    expect((await post({ fromMs: 0, toMs: 5000 })).status).toBe(404);
    expect(db.rows).toEqual([]);
  });
  it("before 0278: a quiet 204 (playback must never break)", async () => {
    db.error = { code: "PGRST205", message: "missing" };
    expect((await post({ fromMs: 0, toMs: 5000 })).status).toBe(204);
  });
});
