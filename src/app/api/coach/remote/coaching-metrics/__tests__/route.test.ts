import { describe, it, expect, vi } from "vitest";

/** GET /api/coach/remote/coaching-metrics (RSS Phase 4): while D8 is NOT DECIDED it answers 409 naming D8 — never
 *  a number computed under a guessed rule. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "mgr1", companyId: "co1" })) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async () => []) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("must not read before D8"); } }));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET } from "../route";

describe("GET coaching-metrics", () => {
  it("403 for a non-manager", async () => {
    (requireSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    expect((await GET(new Request("http://t/x") as never)).status).toBe(403);
  });
  it("409 naming D8 while it is not decided, with no data read", async () => {
    const res = await GET(new Request("http://t/x") as never);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ decided: false, decision: "D8" });
  });
});
