import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn() }));
const st = vi.hoisted(() => ({ inserted: [] as unknown[], insertRes: { data: { id: 7 }, error: null } as { data: unknown; error: unknown }, notes: { data: [] as unknown[], error: null as unknown } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in"]) b[m] = () => b;
      b.then = (r: (v: unknown) => unknown) => r(t === "call_notes" ? st.notes : { data: [], error: null });
      b.insert = (row: unknown) => (st.inserted.push(row), { select: () => ({ maybeSingle: async () => st.insertRes }) });
      return b;
    },
  }),
}));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { GET, POST } from "../route";

const P = { params: Promise.resolve({ id: "s1" }) };
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never;
const sess = (over: Record<string, unknown> = {}) => ({ id: "s1", agentId: "rep1", status: "completed", startedAt: "2026-11-23T10:00:00Z", audioStartedAt: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveApiAuth).mockResolvedValue({ userId: "rep1", companyId: "co1" } as never);
  vi.mocked(getSession).mockResolvedValue(sess() as never);
  st.inserted = [];
  st.insertRes = { data: { id: 7 }, error: null };
  st.notes = { data: [], error: null };
});

describe("call notes", () => {
  it("the call's rep adds a note; long numbers are removed (D15)", async () => {
    expect((await POST(post({ body: " card 4111 1111 1111 1111 " }), P)).status).toBe(200);
    expect(st.inserted[0]).toMatchObject({ company_id: "co1", session_id: "s1", author_id: "rep1", at_ms: null, body: "card [number removed]" });
  });
  it("a note taken during a live call is stamped with the moment in the call", async () => {
    vi.mocked(getSession).mockResolvedValue(sess({ status: "active", startedAt: new Date(Date.now() - 90_000).toISOString() }) as never);
    await POST(post({ body: "price came up" }), P);
    const at = (st.inserted[0] as { at_ms: number }).at_ms;
    expect(at).toBeGreaterThanOrEqual(89_000);
    expect(at).toBeLessThan(95_000);
  });
  it("someone else (a manager) cannot write on the rep's call, but reads its notes", async () => {
    vi.mocked(resolveApiAuth).mockResolvedValue({ userId: "mgr", companyId: "co1" } as never);
    expect((await POST(post({ body: "x" }), P)).status).toBe(403);
    expect(st.inserted).toEqual([]);
    st.notes = { data: [{ id: 1, author_id: "rep1", at_ms: 5000, body: "hi", created_at: "2026-11-23T10:01:00Z" }], error: null };
    expect(await (await GET(new Request("http://x") as never, P)).json()).toMatchObject({ canWrite: false, notes: [{ id: 1, atMs: 5000, body: "hi" }] });
  });
  it("a call the caller can't open is a 404; a failed read is a 500; an empty note is refused", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    expect((await GET(new Request("http://x") as never, P)).status).toBe(404);
    st.notes = { data: null, error: { code: "XX000", message: "x" } } as never;
    expect((await GET(new Request("http://x") as never, P)).status).toBe(500);
    expect((await POST(post({ body: "   " }), P)).status).toBe(400);
  });
});
