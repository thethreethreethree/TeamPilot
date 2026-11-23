import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn() }));
type Res = { data: unknown; error: unknown };
const st = vi.hoisted(() => ({ reads: {} as Record<string, Res>, filters: [] as Array<[string, string, unknown]> }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@Example.com` } } }) } },
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "gte", "limit"]) b[m] = () => b;
      b.eq = (c: string, v: unknown) => (st.filters.push([t, c, v]), b);
      b.in = (c: string, v: unknown) => (st.filters.push([t, c, v]), b);
      b.then = (r: (v: unknown) => unknown) => r(st.reads[t] ?? { data: [], error: null });
      return b;
    },
  }),
}));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { GET } from "../route";

const req = () => new Request("http://x/api") as never;
const recent = new Date(Date.now() - 86_400_000).toISOString();

beforeEach(() => {
  vi.mocked(requireSalesCoachManager).mockResolvedValue({ userId: "m", companyId: "co1" });
  vi.mocked(treeFilterReps).mockResolvedValue(["r1"]);
  st.filters = [];
  st.reads = {
    profiles: { data: [{ id: "m", full_name: "Mia" }, { id: "r1", full_name: "Rob" }, { id: "r9", full_name: "Other team" }], error: null },
    coaching_sessions: { data: [{ agent_id: "r1", started_at: recent }], error: null },
    ask_coach_chats: { data: [{ id: "ch", owner_id: "r1" }], error: null },
    ask_coach_turns: { data: [{ chat_id: "ch", created_at: recent }], error: null },
    login_attempts: { data: [{ email: "r1@example.com", created_at: recent }], error: null },
  };
});

describe("GET /api/coach/remote/usage", () => {
  it("managers only", async () => {
    vi.mocked(requireSalesCoachManager).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(403);
  });
  it("the caller's tree (and themself) only; every read pinned to the company and those people", async () => {
    const j = await (await GET(req())).json();
    expect(j.rows.map((r: { name: string }) => r.name)).toEqual(["Mia", "Rob"]);
    expect(j.rows[1]).toMatchObject({ last7: { calls: 1, questions: 1, signIns: 1 } });
    expect(st.filters).toContainEqual(["coaching_sessions", "agent_id", ["m", "r1"]]);
    expect(st.filters).toContainEqual(["coaching_sessions", "company_id", "co1"]);
    expect(st.filters).toContainEqual(["ask_coach_turns", "role", "user"]);
  });
  it("never sends anyone's email to the browser", async () => {
    expect(JSON.stringify(await (await GET(req())).json())).not.toMatch(/@example\.com/i);
  });
  it("a failed source is a 500, never a lower count", async () => {
    st.reads.training_attempts = { data: null, error: { message: "x" } };
    expect((await GET(req())).status).toBe(500);
  });
});
