import { describe, it, expect, vi } from "vitest";

/** GET /api/coach/remote/coaching-metrics (RSS Phase 4). D8 was NOT DECIDED (409, never a guessed number) until the
 *  founder decided it on 2026-11-22; it now computes under the chosen rule. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "mgr1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async () => []) }));
// Every read answers empty: the point here is that the decided route computes instead of refusing.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "gte", "order", "range", "limit", "is"]) q[m] = () => q;
      (q as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(res({ data: [], error: null }));
      return q;
    },
  }),
}));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET } from "../route";

describe("GET coaching-metrics", () => {
  it("403 for a non-manager", async () => {
    (requireSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    expect((await GET(new Request("http://t/x") as never)).status).toBe(403);
  });
  it("D8 decided (founder 2026-11-22): the metrics are computed, not refused", async () => {
    const res = await GET(new Request("http://t/x") as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ decided: true, sessions: 0, feedbackGiven: {}, callsListened: {} });
  });
});
