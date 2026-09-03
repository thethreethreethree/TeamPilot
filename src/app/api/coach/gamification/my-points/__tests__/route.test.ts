import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/gamification/my-points — the caller's OWN banked-session points. 401 unauthenticated; otherwise
 * returns the rows (points + band from detail) + total/avg computed by the app. The supabase client is faked.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET } from "../route";

const setAuth = (v: unknown) => (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);
const setRows = (rows: unknown[]) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
      return chain;
    },
  });
const req = () => new Request("http://localhost/api/coach/gamification/my-points") as never;

beforeEach(() => vi.clearAllMocks());

describe("GET my-points", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setRows([]);
    expect((await GET(req())).status).toBe(401);
  });

  it("returns the caller's points with total + avg + band from detail", async () => {
    setAuth({ userId: "u1", companyId: "c1", isAdmin: false });
    setRows([
      { session_id: "s1", points: 60, detail: { band: "solid" }, created_at: "2026-08-01T00:00:00Z" },
      { session_id: "s2", points: 80, detail: { band: "strong" }, created_at: "2026-08-02T00:00:00Z" },
    ]);
    const body = await (await GET(req())).json();
    expect(body.sessions).toBe(2);
    expect(body.total).toBe(140);
    expect(body.avg).toBe(70);
    expect(body.rows[0]).toMatchObject({ session_id: "s1", points: 60, band: "solid" });
  });

  it("empty history → zeros, not an error", async () => {
    setAuth({ userId: "u1", companyId: "c1", isAdmin: false });
    setRows([]);
    const body = await (await GET(req())).json();
    expect(body).toMatchObject({ sessions: 0, total: 0, avg: 0, rows: [] });
  });
});
