import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/kpi/trajectory — the caller's OWN month-over-month KPI series (§3.6). Locks: 401
 * unauthenticated, that it pins to the caller (`agent_id = ctx.userId`) and reads only the frozen monthly
 * rows (`period != 'current'`), and that it feeds them through buildTrajectory (the honest gates: building
 * until 2 months, delta null unless two real values). The supabase client is faked with a table data map;
 * the chain records the eq/neq filters so the self-scope + monthly-only reads are asserted, not assumed.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET } from "../route";

/** The route now resolves auth from the request (cookie first, then a mobile
 *  Bearer token), so it needs one. Same helper shape as the kpi/me tests. */
const req = () => new Request("http://localhost/api/coach/kpi/trajectory");

const setAuth = (v: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/** Records the filters applied so the test can assert the self-scope + monthly-only reads. */
const filters: { eq: Array<[string, unknown]>; neq: Array<[string, unknown]> } = { eq: [], neq: [] };

const setRows = (rows: unknown[]) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (col: string, val: unknown) => {
        filters.eq.push([col, val]);
        return chain;
      };
      chain.neq = (col: string, val: unknown) => {
        filters.neq.push([col, val]);
        return chain;
      };
      chain.order = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
      return chain;
    },
  });

const row = (metric: string, layer: number, value: number | null, period: string) => ({
  metric,
  layer,
  value,
  period,
  sample_size: value === null ? 0 : 8,
});

beforeEach(() => {
  vi.clearAllMocks();
  filters.eq = [];
  filters.neq = [];
});

describe("GET /api/coach/kpi/trajectory", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setRows([]);
    expect((await GET(req())).status).toBe(401);
  });

  it("pins to the caller (agent_id = self) and reads only the monthly snapshots (period != current)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setRows([]);
    await GET(req());
    expect(filters.eq).toContainEqual(["agent_id", "u1"]);
    expect(filters.neq).toContainEqual(["period", "current"]);
  });

  it("builds the month-over-month series through buildTrajectory (2 months → not building + a delta)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setRows([
      row("conversionRate", 1, 40, "2026-06"),
      row("conversionRate", 1, 46, "2026-07"),
    ]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.building).toBe(false);
    expect(body.monthsCovered).toBe(2);
    expect(body.metrics[0].metric).toBe("conversionRate");
    expect(body.metrics[0].latest).toBe(46);
    expect(body.metrics[0].delta).toBe(6);
  });

  it("a single month reads as building (no fabricated trend)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setRows([row("conversionRate", 1, 42, "2026-07")]);
    const body = await (await GET(req())).json();
    expect(body.building).toBe(true);
    expect(body.metrics[0].delta).toBeNull();
  });
});
