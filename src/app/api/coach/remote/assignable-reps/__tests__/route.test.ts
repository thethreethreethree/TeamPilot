import { describe, it, expect, vi, beforeEach } from "vitest";

/** /assignable-reps: active people in the company the tree allows, never the manager; an unanswerable tree check is a 503. */
const st = vi.hoisted(() => ({ manager: true, tree: ["r1", "r2"] as string[] | null }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => (st.manager ? { userId: "m1", companyId: "co1" } : null)) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterRepsChecked: vi.fn(async (_r: unknown, ids: string[]) => (st.tree === null ? null : ids.filter((i) => st.tree!.includes(i)))) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) q[m] = () => q;
      q.range = async (from: number) => ({ data: from > 0 ? [] : [{ id: "m1", full_name: "Max" }, { id: "r2", full_name: "Bo" }, { id: "r1", full_name: "Ana" }, { id: "x9", full_name: "Other team" }], error: null });
      return q;
    },
  }),
}));
import { GET } from "../route";
const get = () => GET(new Request("http://t/x") as never);
beforeEach(() => {
  st.manager = true;
  st.tree = ["r1", "r2"];
});

describe("assignable reps", () => {
  it("lists the tree's people by name, without the manager or other teams", async () => {
    expect((await (await get()).json()).members).toEqual([{ id: "r1", full_name: "Ana" }, { id: "r2", full_name: "Bo" }]);
  });
  it("a failed tree check is a 503; non-managers are refused", async () => {
    st.tree = null;
    expect((await get()).status).toBe(503);
    st.manager = false;
    expect((await get()).status).toBe(403);
  });
});
