import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
// The caller (m1) may see m3 but not m2.
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn(async (_r: unknown, ids: string[]) => ids.filter((i) => i === "m3")) }));
const PEOPLE = [
  { id: "m1", company_id: "co1", manager_id: null, full_name: "Mia" },
  { id: "m3", company_id: "co1", manager_id: "m1", full_name: "Theo" },
  { id: "m2", company_id: "co1", manager_id: null, full_name: "Zed" },
  { id: "r1", company_id: "co1", manager_id: "m3", full_name: "Rae" },
  { id: "r2", company_id: "co1", manager_id: "m2", full_name: "Sam" },
].map((p) => ({ ...p, role: "Member", sales_coach_role: null }));
const eqs: Array<[string, unknown]> = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.in = () => q;
      q.eq = (c: string, v: unknown) => (eqs.push([c, v]), q);
      q.then = (res: (v: unknown) => unknown) => res({ data: PEOPLE, error: null });
      return q;
    },
  }),
}));
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET } from "../route";

describe("GET teams (F10.9 / F16.6)", () => {
  it("my own team first, then the teams I may see — never one outside my access", async () => {
    const body = await (await GET(new Request("http://x") as never)).json();
    expect(body.teams).toEqual([
      { id: "m1", name: "My team", size: 3, mine: true },
      { id: "m3", name: "Theo's team", size: 2, mine: false },
    ]);
    expect(eqs.every(([c, v]) => c !== "company_id" || v === "co1")).toBe(true);
  });
  it("a non-manager is refused", async () => {
    vi.mocked(requireSalesCoachManager).mockResolvedValueOnce(null);
    expect((await GET(new Request("http://x") as never)).status).toBe(403);
  });
});
