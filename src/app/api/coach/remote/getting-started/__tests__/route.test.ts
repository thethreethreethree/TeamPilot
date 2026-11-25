import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const st = vi.hoisted(() => ({ counts: {} as Record<string, number>, fail: "" , filters: [] as Array<[string, string, unknown]> }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.in = () => q;
      q.eq = (k: string, v: unknown) => (st.filters.push([t, k, v]), q);
      q.then = (res: (v: unknown) => unknown) => res(t === st.fail ? { count: null, error: { message: "x" } } : { count: st.counts[t] ?? 0, error: null });
      return q;
    },
  }),
}));
import { GET } from "../route";

beforeEach(() => {
  st.counts = {};
  st.fail = "";
  st.filters = [];
});

describe("GET getting-started (F36.40)", () => {
  it("ticks each step from the caller's own rows", async () => {
    st.counts = { coaching_sessions: 3, remote_prospects: 1 };
    const j = await (await GET(new Request("http://x") as never)).json();
    expect(j.steps.map((s: { key: string; done: boolean }) => [s.key, s.done])).toEqual([["call", true], ["checklist", false], ["prospect", true], ["practice", false]]);
    expect(j.complete).toBe(false);
    expect(st.filters).toContainEqual(["remote_checklist_reviews", "reviewed_by", "u1"]);
    expect(st.filters).toContainEqual(["training_attempts", "rep_id", "u1"]);
  });
  it("a failed read is an error, never 'not done yet'", async () => {
    st.fail = "remote_prospects";
    expect((await GET(new Request("http://x") as never)).status).toBe(500);
  });
});
