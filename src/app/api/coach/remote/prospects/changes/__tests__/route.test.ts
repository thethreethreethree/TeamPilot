import { describe, it, expect, vi, beforeEach } from "vitest";

/** GET prospects/changes: the caller's prospects and their events (caller's client); a failed read is a 500. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/coach/remote/prospects", () => ({ listProspects: vi.fn() }));
const st = vi.hoisted(() => ({ events: { data: [] as unknown[] | null, error: null as unknown } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "in", "order"]) b[m] = () => b;
      b.range = async (a: number) => (a === 0 ? st.events : { data: [], error: null });
      return b;
    },
  }),
}));
import { listProspects } from "@/lib/coach/remote/prospects";
import { GET } from "../route";

const get = (q: string) => new Request(`http://x/api?${q}`) as never;
const W = "from=2026-11-16T00:00:00Z&to=2026-11-23T00:00:00Z";
beforeEach(() => {
  vi.mocked(listProspects).mockResolvedValue([{ id: "a", name: "Acme" }] as never);
  st.events = {
    data: [
      { id: 1, prospect_id: "a", kind: "stage", value: { status: "open" }, created_at: "2026-11-01T10:00:00Z" },
      { id: 2, prospect_id: "a", kind: "stage", value: { status: "won" }, created_at: "2026-11-20T10:00:00Z" },
    ],
    error: null,
  };
});

describe("GET prospects/changes", () => {
  it("the week's changes, named", async () => {
    const j = await (await GET(get(W))).json();
    expect(j.changes).toEqual([{ kind: "won", prospectId: "a", at: "2026-11-20T10:00:00Z", amount: null, name: "Acme" }]);
    expect(j.summary).toMatchObject({ won: 1 });
  });
  it("a bad period is refused; a failed read is a 500", async () => {
    expect((await GET(get("from=x&to=y"))).status).toBe(400);
    expect((await GET(get("from=2026-01-01T00:00:00Z&to=2026-11-01T00:00:00Z"))).status).toBe(400);
    st.events = { data: null, error: { message: "x" } };
    expect((await GET(get(W))).status).toBe(500);
    vi.mocked(listProspects).mockResolvedValue(null);
    expect((await GET(get(W))).status).toBe(500);
  });
});
