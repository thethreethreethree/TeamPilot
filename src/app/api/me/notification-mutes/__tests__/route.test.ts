import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const st = vi.hoisted(() => ({ inserts: [] as unknown[] }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: async (r: unknown) => (st.inserts.push(r), { error: null }) }) }) }));
import { PUT } from "../route";

const put = (body: unknown) => PUT(new Request("http://x", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) as never);
beforeEach(() => {
  st.inserts = [];
});

describe("PUT /api/me/notification-mutes", () => {
  it("records a change for the caller, user and company from the session", async () => {
    expect((await put({ type: "call_scored", muted: true, user_id: "someone-else" })).status).toBe(200);
    expect(st.inserts).toEqual([{ company_id: "co1", user_id: "u1", type: "call_scored", muted: true }]);
  });
  it("an action notice can't be muted", async () => {
    expect((await put({ type: "score_disputed", muted: true })).status).toBe(400);
    expect(st.inserts).toEqual([]);
  });
});
