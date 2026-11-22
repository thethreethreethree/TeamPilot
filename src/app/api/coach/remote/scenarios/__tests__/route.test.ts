import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/scenarios — managers only. Pinned (2026-11-23): a rep is refused; a scenario "from this call" needs a
 * call the manager can open AND whose rep the reporting tree lets them see — otherwise 404 and nothing is saved.
 */
const st = vi.hoisted(() => ({
  mgr: { userId: "m-1", companyId: "co1" } as null | { userId: string; companyId: string },
  session: { id: "s1", agentId: "rep-1" } as null | { id: string; agentId: string },
  treeAllows: true,
  inserts: [] as unknown[],
}));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => st.mgr) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => st.treeAllows) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: unknown) => {
        st.inserts.push(row);
        return { select: () => ({ maybeSingle: async () => ({ data: { id: "sc-1" }, error: null }) }) };
      },
    }),
  }),
}));

import { POST } from "../route";

const SCN = { title: "Price pushback", persona: "Busy owner", situation: "Already has cable", focus: "Isolate the objection", channel: "phone", difficulty: "intermediate", lengthMin: 5 };
const post = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  st.mgr = { userId: "m-1", companyId: "co1" };
  st.session = { id: "s1", agentId: "rep-1" };
  st.treeAllows = true;
  st.inserts = [];
});

describe("practice scenarios", () => {
  it("a manager saves one for their own company", async () => {
    expect((await post(SCN)).status).toBe(200);
    expect(st.inserts).toEqual([expect.objectContaining({ company_id: "co1", created_by: "m-1", source_session_id: null, length_min: 5 })]);
  });

  it("a rep is refused", async () => {
    st.mgr = null;
    expect((await post(SCN)).status).toBe(403);
    expect(st.inserts).toEqual([]);
  });

  it("from a call the manager can open, whose rep is in their tree → linked to it", async () => {
    expect((await post({ ...SCN, sourceSessionId: "s1" })).status).toBe(200);
    expect(st.inserts).toEqual([expect.objectContaining({ source_session_id: "s1" })]);
  });

  it("from a call outside the manager's tree → 404, nothing saved", async () => {
    st.treeAllows = false;
    expect((await post({ ...SCN, sourceSessionId: "s1" })).status).toBe(404);
    expect(st.inserts).toEqual([]);
  });

  it("from a call the manager can't open → 404, nothing saved", async () => {
    st.session = null;
    expect((await post({ ...SCN, sourceSessionId: "s1" })).status).toBe(404);
    expect(st.inserts).toEqual([]);
  });

  it("refuses a missing field, an unknown channel and an out-of-range length", async () => {
    for (const body of [{ ...SCN, focus: "" }, { ...SCN, channel: "fax" }, { ...SCN, lengthMin: 45 }]) expect((await post(body)).status).toBe(400);
    expect(st.inserts).toEqual([]);
  });
});
