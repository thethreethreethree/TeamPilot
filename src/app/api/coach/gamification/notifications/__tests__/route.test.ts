import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/gamification/notifications — the bell. Previously untested at the route (R2 of
 * docs/tbc/2026-09-22-bell-unread: "A change to `.is("read_at", null)` would fail nothing in the suite").
 *
 * Pinned here: the unread badge is a SEPARATE whole-table count filtered on read_at IS NULL (never a tally of the
 * newest page, which undercounts past fifty); a failed count shows no badge rather than a guessed number; and
 * mark-read is pinned to the caller and to unread rows. The SQL view 0264 is covered by scripts/sql-harness.mjs;
 * this is the PostgREST query the route builds, which that harness cannot reach.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn(() => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, POST } from "../route";

type Call = { method: string; args: unknown[] };

/** A query-builder double that records every call on one chain and resolves to `result`. */
function chain(result: unknown, calls: Call[]) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "is", "eq", "in", "update"]) {
    c[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return c;
    };
  }
  c.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return c;
}

/** The two GET queries, in order: the page, then the unread count. */
function setDb(page: unknown, unread: unknown) {
  const listCalls: Call[] = [];
  const unreadCalls: Call[] = [];
  let n = 0;
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: () => (n++ === 0 ? chain(page, listCalls) : chain(unread, unreadCalls)),
  });
  return { listCalls, unreadCalls };
}

const req = (body?: unknown) =>
  ({ json: async () => body, headers: new Headers({ "content-type": "application/json" }) }) as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.clearAllMocks();
  (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "mgr1" });
});

describe("GET /notifications", () => {
  it("401 when not signed in", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("the badge is a whole-table count of read_at IS NULL, not a tally of the newest page", async () => {
    const page = { data: [{ id: "n1", read_at: null }, { id: "n2", read_at: "2026-10-01T00:00:00Z" }], error: null, count: 140 };
    const { unreadCalls } = setDb(page, { count: 120, error: null });
    const body = await (await GET(req())).json();
    expect(body.unread).toBe(120); // the page holds 1 unread; the badge must say 120
    expect(body.total).toBe(140);
    expect(unreadCalls).toContainEqual({ method: "is", args: ["read_at", null] });
    expect(unreadCalls).toContainEqual({ method: "select", args: ["id", { count: "exact", head: true }] });
    expect(unreadCalls.some((c) => c.method === "limit")).toBe(false); // never bounded to a page
  });

  it("a failed unread count shows no badge, never the page's own tally", async () => {
    setDb({ data: [{ id: "n1", read_at: null }], error: null, count: 1 }, { count: null, error: { message: "boom" } });
    const body = await (await GET(req())).json();
    expect(body.unread).toBeNull();
    expect(body.notifications).toHaveLength(1);
  });

  it("a failed list is a 500 with a plain sentence, not the database's message", async () => {
    setDb({ data: null, error: { message: "relation does not exist" }, count: null }, { count: 0, error: null });
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });
});

describe("POST /notifications (mark read)", () => {
  function setAdmin() {
    const calls: Call[] = [];
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => chain({ error: null }, calls),
    });
    return calls;
  }

  it("marks all of the CALLER's unread rows, and only those", async () => {
    const calls = setAdmin();
    const res = await POST(req({ all: true }));
    expect(res.status).toBe(200);
    expect(calls).toContainEqual({ method: "eq", args: ["recipient_id", "mgr1"] });
    expect(calls).toContainEqual({ method: "is", args: ["read_at", null] });
    expect(calls.some((c) => c.method === "in")).toBe(false);
  });

  it("marks only the named ids, still pinned to the caller", async () => {
    const calls = setAdmin();
    const id = "11111111-1111-4111-8111-111111111111";
    await POST(req({ ids: [id] }));
    expect(calls).toContainEqual({ method: "eq", args: ["recipient_id", "mgr1"] });
    expect(calls).toContainEqual({ method: "in", args: ["id", [id]] });
  });
});
