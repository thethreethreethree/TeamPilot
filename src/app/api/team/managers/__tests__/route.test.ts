import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn(async () => ({ userId: "u", companyId: "co1", isAdmin: true })) }));
const db = vi.hoisted(() => ({ rpc: {} as Record<string, { data: unknown; error: unknown }> }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string) => db.rpc[fn] ?? { data: null, error: { message: "missing" } },
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: [{ id: "r1", manager_id: null }], error: null });
      return b;
    },
  }),
}));
import { GET } from "../route";

beforeEach(() => (db.rpc = {}));

describe("GET /api/team/managers — the tree verdict (0287)", () => {
  it("passes the database's verdict through: off, and who is keeping it off", async () => {
    db.rpc = { rss_tree_active: { data: false, error: null }, rss_tree_blockers: { data: ["r1"], error: null } };
    expect(await (await GET(new Request("http://x") as never)).json()).toMatchObject({ available: true, tree: { active: false, blockers: ["r1"] } });
  });
  it("accepts the object-row shape PostgREST can return for setof", async () => {
    db.rpc = { rss_tree_active: { data: false, error: null }, rss_tree_blockers: { data: [{ rss_tree_blockers: "r1" }], error: null } };
    expect((await (await GET(new Request("http://x") as never)).json()).tree.blockers).toEqual(["r1"]);
  });
  it("before 0287 the verdict is null — never a guessed 'on'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await (await GET(new Request("http://x") as never)).json()).tree).toBeNull();
  });
});
