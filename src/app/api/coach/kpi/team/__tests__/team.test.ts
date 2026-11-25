import { describe, it, expect, vi, beforeEach } from "vitest";

/** GET /api/coach/kpi/team?team= (F23.8, 26 Nov): the per-rep table narrowed to one manager's team; a refused team
 *  is passed through. The team rule itself is tested in teamScope.test.ts. */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn(async () => ({ userId: "m1", companyId: "co1", isAdmin: true })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => true) }));
const scope = vi.hoisted(() => ({ result: { ok: true, members: null } as { ok: true; members: Set<string> | null } | { ok: false; status: number; error: string } }));
vi.mock("@/lib/coach/remote/teamScope", () => ({ teamFromRequest: vi.fn(async () => scope.result) }));
const asked = vi.hoisted(() => ({ agentIds: [] as unknown[] }));
import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

beforeEach(() => {
  asked.agentIds = [];
  scope.result = { ok: true, members: null };
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: (t: string) => {
      const c: Record<string, unknown> = {};
      for (const m of ["select", "eq", "not", "order", "range"]) c[m] = () => c;
      c.in = (col: string, v: unknown) => (t === "coaching_sessions" && col === "agent_id" && asked.agentIds.push(v), c);
      c.maybeSingle = async () => ({ data: t === "profiles" ? { role: "CEO", sales_coach_role: "admin", company_id: "co1" } : null, error: null });
      c.then = (res: (v: unknown) => unknown) => res({ data: t === "profiles" ? [{ id: "r1", full_name: "Rae", role: "Member" }, { id: "r2", full_name: "Sam", role: "Member" }] : [], error: null });
      return c;
    },
  });
});

describe("GET /api/coach/kpi/team?team= (F23.8)", () => {
  it("reads only the chosen team's reps", async () => {
    scope.result = { ok: true, members: new Set(["r2"]) };
    expect((await GET(new Request("http://x/api/coach/kpi/team?team=x"))).status).toBe(200);
    expect(asked.agentIds).toContainEqual(["r2"]);
    expect(asked.agentIds).not.toContainEqual(["r1", "r2"]);
  });
  it("a team outside the caller's tree is refused, nothing read", async () => {
    scope.result = { ok: false, status: 404, error: "Team not found." };
    expect((await GET(new Request("http://x/api/coach/kpi/team?team=x"))).status).toBe(404);
    expect(asked.agentIds).toEqual([]);
  });
});
