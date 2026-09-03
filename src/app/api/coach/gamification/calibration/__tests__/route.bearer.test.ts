import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * calibration — the mobile Bearer path for the MANAGER gate. requireManager(req) resolves identity via
 * resolveApiAuth (cookie OR Bearer); a mobile manager (Bearer, isAdmin) must pass the gate and get the report. This
 * is a DISTINCT auth path from my-points (manager gate + admin reads, not an owner caller-scoped read), so it earns
 * its own test. resolveApiAuth is stubbed to a Bearer-authenticated manager; the admin client is faked per-table.
 */
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "../route";

const bearerReq = () =>
  new Request("http://localhost/api/coach/gamification/calibration", { headers: { authorization: "Bearer tok" } }) as never;

/** Per-table thenable builder (mirrors the calibration route test's admin fake). */
function setTables(tables: Record<string, unknown>) {
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from(table: string) {
      const result = tables[table] ?? { data: null, error: null };
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "maybeSingle"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res(result);
      return b;
    },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("calibration — mobile Bearer path (manager gate)", () => {
  it("a Bearer-authenticated manager passes the gate and gets the report", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "mgr", companyId: "c1", isAdmin: true });
    setTables({
      after_pitch_summaries: { data: [{ session_id: "s1", payload: { scores: [{ key: "opener", score: 8 }] } }] },
      gamification_calibration: { data: [] },
      coaching_transcript_segments: { data: [] },
    });
    const res = await GET(bearerReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pool).toBe(1);
    expect(body.scored).toBe(0);
  });

  it("403 when the Bearer caller is neither admin nor a sales_coach manager", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", companyId: "c1", isAdmin: false });
    setTables({ profiles: { data: { sales_coach_role: "member" } } });
    expect((await GET(bearerReq())).status).toBe(403);
  });

  it("403 when the Bearer token does not authenticate", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    setTables({});
    expect((await GET(bearerReq())).status).toBe(403);
  });
});
