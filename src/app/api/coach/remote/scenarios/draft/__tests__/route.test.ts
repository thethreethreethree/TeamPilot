import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
const st = vi.hoisted(() => ({ segs: [] as unknown[], llm: { text: "", suppressed: false }, calls: 0 }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order"]) q[m] = () => q;
      q.then = (res: (v: unknown) => unknown) => res({ data: st.segs, error: null });
      return q;
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/claude", () => ({ dissectCoachV5: vi.fn(async () => (st.calls++, st.llm)) }));
import { getSession } from "@/lib/data/salesCoach";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { POST } from "../route";

const SID = "11111111-1111-4111-8111-111111111111";
const call = () => POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: SID }) }) as never);
const S = { id: SID, companyId: "co1", context: "phone", sessionKind: "sales", status: "ended" };
beforeEach(() => {
  vi.clearAllMocks();
  st.calls = 0;
  st.segs = [{ speaker: "agent", text: "Hi" }, { speaker: "customer", text: "I already have two quotes" }];
  st.llm = { text: '{"title":"The price-shopper","persona":"Busy owner","situation":"Has two quotes, call 555-123-4567.","focus":"Price objection"}', suppressed: false };
  vi.mocked(getSession).mockResolvedValue(S as never);
});

describe("POST scenarios/draft", () => {
  it("drafts from the call, with personal details removed; saves nothing", async () => {
    const j = await (await call()).json();
    expect(j.draft).toEqual({ title: "The price-shopper", persona: "Busy owner", situation: "Has two quotes, call [removed].", focus: "Price objection" });
  });
  it("not a manager → 403, no AI call", async () => {
    vi.mocked(requireSalesCoachManager).mockResolvedValueOnce(null);
    expect((await call()).status).toBe(403);
    expect(st.calls).toBe(0);
  });
  it("a call this manager can't open, or a door pitch, is refused before any AI call", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect((await call()).status).toBe(404);
    vi.mocked(getSession).mockResolvedValueOnce({ ...S, context: "in_person" } as never);
    expect((await call()).status).toBe(409);
    expect(st.calls).toBe(0);
  });
  it("no customer lines → says so, no AI call", async () => {
    st.segs = [{ speaker: "agent", text: "Hello?" }];
    expect((await call()).status).toBe(409);
    expect(st.calls).toBe(0);
  });
  it("AI guidance off (baseline month) → no draft, the reason in plain words", async () => {
    st.llm = { text: "", suppressed: true };
    const j = await (await call()).json();
    expect(j.draft).toBeNull();
    expect(j.reason).toMatch(/AI guidance is off/);
  });
});
