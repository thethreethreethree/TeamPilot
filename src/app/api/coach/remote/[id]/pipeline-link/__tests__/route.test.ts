import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/coach/remote/prospects", () => ({ listProspects: vi.fn() }));
type Res = { data: unknown; error: unknown };
const st = vi.hoisted(() => ({ reads: {} as Record<string, Res> }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.maybeSingle = async () => st.reads[t] ?? { data: null, error: null };
      return b;
    },
  }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { listProspects } from "@/lib/coach/remote/prospects";
import { GET } from "../route";

const ID = "11111111-1111-4111-8111-111111111111";
const P = { params: Promise.resolve({ id: ID }) };
const get = () => new Request("http://x/api") as never;
const session = (over: Record<string, unknown> = {}) => ({ id: ID, agentId: "rep1", context: "phone", status: "completed", clientLabel: "Betty – Acme", ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveApiAuth).mockResolvedValue({ userId: "rep1", companyId: "co1" } as never);
  vi.mocked(getSession).mockResolvedValue(session() as never);
  vi.mocked(listProspects).mockResolvedValue([
    { id: "p2", name: "Zed", organization: null, status: "open" },
    { id: "p1", name: "Acme", organization: "Acme Inc", status: "open" },
    { id: "p3", name: "Won one", organization: null, status: "won" },
  ] as never);
  st.reads = {};
});

describe("GET pipeline-link", () => {
  it("the call's rep gets their OPEN prospects, by name, to add the call to", async () => {
    const j = await (await GET(get(), P)).json();
    expect(j).toMatchObject({ remote: true, isOwner: true, label: "Betty – Acme", prospect: null });
    expect(j.options.map((o: { id: string }) => o.id)).toEqual(["p1", "p2"]);
  });
  it("a linked call shows its prospect and offers nothing", async () => {
    st.reads = { remote_prospect_calls: { data: { prospect_id: "p1" }, error: null }, remote_prospects_current: { data: { id: "p1", name: "Acme", status: "open" }, error: null } };
    const j = await (await GET(get(), P)).json();
    expect(j).toMatchObject({ prospect: { id: "p1", name: "Acme" }, options: [] });
    expect(listProspects).not.toHaveBeenCalled();
  });
  it("someone else (a manager) reads the link but gets no options", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue({ userId: "mgr", companyId: "co1" } as never);
    expect(await (await GET(get(), P)).json()).toMatchObject({ isOwner: false, options: [] });
  });
  it("a failed link read is a 500 — never 'not in the pipeline' (that would invite a duplicate)", async () => {
    st.reads = { remote_prospect_calls: { data: null, error: { message: "x" } } };
    expect((await GET(get(), P)).status).toBe(500);
  });
  it("a call the caller can't open is a 404; an in-person call is not remote", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect((await GET(get(), P)).status).toBe(404);
    vi.mocked(getSession).mockResolvedValueOnce(session({ context: "in_person" }) as never);
    expect(await (await GET(get(), P)).json()).toEqual({ remote: false });
  });
});
