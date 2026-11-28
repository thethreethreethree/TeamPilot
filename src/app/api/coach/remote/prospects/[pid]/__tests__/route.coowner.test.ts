import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A co-owner opens a deal they can't otherwise see (0395; founder picker "Co-owners see deals they co-own"): only after
 * the explicit rss_is_co_owner check, read pinned to their company, read only, calls hidden from them left out, no
 * suggestions; anyone else still gets 404.
 */
const st = vi.hoisted(() => ({ coOwner: true, eqs: [] as Array<[string, string, unknown]>, hidden: new Set<string>() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "co-1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenFrom: vi.fn(async () => st.hidden) }));
const table = (name: string, caller: boolean) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "in", "is", "neq", "order", "limit"]) q[m] = () => q;
  q.eq = (c: string, v: unknown) => (caller ? null : st.eqs.push([name, c, v]), q);
  q.maybeSingle = async () => ({ data: caller || name !== "remote_prospects_current" ? null : { id: "d1", rep_id: "rep-9", name: "Acme deal", account_id: null }, error: null });
  q.then = (res: (v: unknown) => unknown) =>
    res({ data: name === "remote_prospect_calls" && !caller ? [{ session_id: "s1", created_at: "t" }, { session_id: "hid", created_at: "t" }] : name === "coaching_sessions" ? [{ id: "s1", client_label: null, context: "phone", started_at: "2026-11-20", outcome: null }] : [], error: null });
  return q;
};
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({ from: (t: string) => table(t, true) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => table(t, false), rpc: async () => ({ data: st.coOwner, error: null }) }) }));
import { GET } from "../route";

const PID = "11111111-1111-4111-8111-111111111111";
const call = () => GET(new Request(`http://x/api/coach/remote/prospects/${PID}`) as never, { params: Promise.resolve({ pid: PID }) });
beforeEach(() => {
  st.coOwner = true;
  st.eqs = [];
  st.hidden = new Set();
});

describe("a co-owner's read-only deal", () => {
  it("opens read only, pinned to their company, hidden calls left out, no suggestions", async () => {
    st.hidden = new Set(["hid"]);
    const r = await call();
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.readOnly).toBe(true);
    expect(st.eqs).toContainEqual(["remote_prospects_current", "company_id", "co1"]);
    expect(j.suggested).toEqual([]);
  });
  it("someone who isn't a co-owner still gets 404", async () => {
    st.coOwner = false;
    expect((await call()).status).toBe(404);
  });
});
