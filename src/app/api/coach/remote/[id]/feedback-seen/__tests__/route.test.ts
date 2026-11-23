import { describe, it, expect, vi, beforeEach } from "vitest";

/** POST feedback-seen (0321): only the call's own rep records a view, through the caller's client. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
const st = vi.hoisted(() => ({ inserts: [] as unknown[], session: { agentId: "rep1", companyId: "co1" } as { agentId: string; companyId: string } | null }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({ from: () => ({ insert: async (row: unknown) => (st.inserts.push(row), { error: null }) }) }),
}));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));

import { POST } from "../route";
const call = () => POST(new Request("http://x", { method: "POST" }) as never, { params: Promise.resolve({ id: "s1" }) });
beforeEach(() => {
  st.inserts = [];
  st.session = { agentId: "rep1", companyId: "co1" };
});

describe("feedback-seen", () => {
  it("the call's rep records a view", async () => {
    expect((await call()).status).toBe(200);
    expect(st.inserts).toEqual([{ company_id: "co1", session_id: "s1", rep_id: "rep1" }]);
  });
  it("someone else's call is refused; an unseen call is 404", async () => {
    st.session = { agentId: "other", companyId: "co1" };
    expect((await call()).status).toBe(403);
    st.session = null;
    expect((await call()).status).toBe(404);
    expect(st.inserts).toEqual([]);
  });
});
