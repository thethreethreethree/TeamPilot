import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/coach/remote/prospects", () => ({ listProspects: vi.fn() }));
const st = vi.hoisted(() => ({
  sessions: { data: [] as unknown[], error: null as unknown },
  links: { data: [] as unknown[], error: null as unknown },
  eqs: [] as Array<[string, unknown]>,
  linkReads: 0,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "in", "gte", "lt", "order", "limit"]) b[m] = () => b;
      b.eq = (c: string, v: unknown) => (st.eqs.push([c, v]), b);
      b.then = (res: (v: unknown) => unknown) => res(t === "coaching_sessions" ? st.sessions : st.links);
      // Paged session reads (2026-11-23): slice the rows like PostgREST's range.
      b.range = async (from: number, to: number) =>
        st.sessions.error ? st.sessions : { data: (st.sessions.data ?? []).slice(from, to + 1), error: null };
      if (t === "remote_prospect_calls") st.linkReads++;
      return b;
    },
  }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { listProspects } from "@/lib/coach/remote/prospects";
import { GET } from "../route";

const get = (q: string) => ({ nextUrl: new URL(`http://x/api?${q}`) }) as never;
const P = (id: string, over: Record<string, unknown> = {}) => ({ id, repId: "u1", name: id, organization: null, status: "open", nextCallDate: null, ...over });

beforeEach(() => {
  vi.mocked(resolveApiAuth).mockResolvedValue({ userId: "u1", companyId: "c1" } as never);
  st.sessions = { data: [], error: null };
  st.links = { data: [], error: null };
  st.eqs = [];
  st.linkReads = 0;
  vi.mocked(listProspects).mockReset();
});

describe("GET /api/coach/remote/calendar", () => {
  it("rejects a bad week or scope", async () => {
    expect((await GET(get("week=nope"))).status).toBe(400);
    expect((await GET(get("week=2026-11-23&scope=everyone"))).status).toBe(400);
  });

  it("a failed pipeline or sessions read is a 500, never an empty week", async () => {
    vi.mocked(listProspects).mockResolvedValue(null);
    expect((await GET(get("week=2026-11-23"))).status).toBe(500);
    vi.mocked(listProspects).mockResolvedValue([]);
    st.sessions = { data: [], error: { message: "x" } };
    expect((await GET(get("week=2026-11-23"))).status).toBe(500);
    st.sessions = { data: [{ id: "s1", agent_id: "u1", client_label: null, started_at: "2026-11-24T15:00:00Z", outcome: null }], error: null };
    st.links = { data: [], error: { message: "x" } };
    expect((await GET(get("week=2026-11-23"))).status).toBe(500);
  });

  it("'mine' reads only the caller; 'team' adds no person filter", async () => {
    vi.mocked(listProspects).mockResolvedValue([]);
    await GET(get("week=2026-11-23&scope=mine"));
    expect(vi.mocked(listProspects).mock.calls[0]![1]).toBe("u1");
    expect(st.eqs).toContainEqual(["agent_id", "u1"]);
    st.eqs = [];
    await GET(get("week=2026-11-23&scope=team"));
    expect(vi.mocked(listProspects).mock.calls[1]![1]).toBeUndefined();
    expect(st.eqs).toEqual([]);
  });

  it("buckets open prospects' next calls and held calls (with their prospect) into the Monday-first week", async () => {
    vi.mocked(listProspects).mockResolvedValue([
      P("Acme", { nextCallDate: "2026-11-25" }),
      P("Won", { status: "won", nextCallDate: "2026-11-25" }),
      P("Beta"),
    ] as never);
    st.sessions = { data: [{ id: "s1", agent_id: "u1", client_label: "Inbound", started_at: "2026-11-24T15:00:00Z", outcome: "sold" }], error: null };
    st.links = { data: [{ session_id: "s1", prospect_id: "Beta" }], error: null };
    const j = await (await GET(get("week=2026-11-26&tz=0"))).json();
    expect(j.from).toBe("2026-11-23");
    expect(j.days[2].booked.map((b: { prospectId: string }) => b.prospectId)).toEqual(["Acme"]);
    expect(j.days[1].held[0]).toMatchObject({ sessionId: "s1", prospectId: "Beta", prospectName: "Beta", outcome: "sold" });
  });

  it("a week with more than 1,000 calls is read whole, its links in groups of 100 (was capped at 500)", async () => {
    vi.mocked(listProspects).mockResolvedValue([]);
    st.sessions = {
      data: Array.from({ length: 1203 }, (_, i) => ({ id: `s${i}`, agent_id: "u1", client_label: null, started_at: "2026-11-24T15:00:00Z", outcome: null })),
      error: null,
    };
    const j = await (await GET(get("week=2026-11-23&tz=0"))).json();
    const held = (j.days as Array<{ held: unknown[] }>).reduce((n, d) => n + d.held.length, 0);
    expect(held).toBe(1203);
    expect(st.linkReads).toBe(13);
  });
});

