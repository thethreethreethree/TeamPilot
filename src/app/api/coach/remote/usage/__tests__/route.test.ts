import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterReps: vi.fn() }));
type Res = { data: unknown; error: unknown };
const st = vi.hoisted(() => ({ reads: {} as Record<string, Res>, filters: [] as Array<[string, string, unknown]>, rpcArgs: null as Record<string, unknown> | null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    // 0327: sign-in times come from one database function (sessions + the web form), matched by user id.
    rpc: async (fn: string, args: Record<string, unknown>) => {
      st.rpcArgs = args;
      return fn === "rss_sign_in_times" ? (st.reads.rss_sign_in_times ?? { data: [], error: null }) : { data: null, error: { message: "unknown" } };
    },
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
    // r1 signed in once on the web (both records, a second apart) and once on the mobile app (a session only).
    rss_sign_in_times: {
      data: [
        { user_id: "r1", at: recent, source: "password" },
        { user_id: "r1", at: new Date(Date.parse(recent) + 1000).toISOString(), source: "session" },
      ],
      error: null,
    },
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
    expect(st.rpcArgs).toMatchObject({ p_company: "co1", p_users: ["m", "r1"] }); // sign-ins: company + those people only
  });
  it("a sign-in from the mobile app (a session with no web-form record) counts too; a failed sign-in read is a 500", async () => {
    st.reads.rss_sign_in_times = { data: [{ user_id: "r1", at: recent, source: "session" }, { user_id: "r1", at: recent, source: "password" }, { user_id: "r1", at: new Date(Date.parse(recent) + 3_600_000).toISOString(), source: "session" }], error: null };
    expect((await (await GET(req())).json()).rows[1].last7.signIns).toBe(2);
    st.reads.rss_sign_in_times = { data: null, error: { message: "x" } };
    expect((await GET(req())).status).toBe(500);
  });
  it("never sends anyone's email to the browser", async () => {
    expect(JSON.stringify(await (await GET(req())).json())).not.toMatch(/@example\.com/i);
  });
  it("a failed source is a 500, never a lower count", async () => {
    st.reads.training_attempts = { data: null, error: { message: "x" } };
    expect((await GET(req())).status).toBe(500);
  });
});
