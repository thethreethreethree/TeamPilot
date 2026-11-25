import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
const who = vi.hoisted(() => ({ ctx: { userId: "adm", companyId: "co1", isAdmin: true } as unknown }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => who.ctx) }));
const st = vi.hoisted(() => ({
  inserts: [] as Array<{ t: string; row: unknown }>,
  audits: [] as unknown[],
  eqs: [] as Array<[string, string, unknown]>,
  afters: [] as Array<() => Promise<void>>,
  scans: [] as Array<[string, unknown]>,
  recentErr: null as unknown,
  phrase: { id: "p1" } as unknown,
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => Promise<void>) => st.afters.push(fn) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async (_a: unknown, e: unknown) => (st.audits.push(e), true)) }));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({
  hiddenCallsForCompany: vi.fn(async () => [{ sessionId: "s9", label: "Acme", startedAt: "2026-11-20T10:00:00Z", repId: "rep1", phrases: ["retired phrase"] }]),
  activeHidePhrases: vi.fn(async () => [{ id: "p1", phrase: "personal call" }]),
  scanCallForHidePhrases: vi.fn(async (_a: unknown, id: string, only: unknown) => void st.scans.push([id, only])),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "in", "gte", "order"]) q[m] = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([t, c, v]), q);
      q.limit = async () => (st.recentErr ? { data: null, error: st.recentErr } : { data: [{ id: "s1" }, { id: "s2" }], error: null });
      q.maybeSingle = async () => ({ data: st.phrase, error: null });
      if (t === "profiles") q.then = (res: (v: unknown) => unknown) => res({ data: [{ id: "rep1", full_name: "Ana" }], error: null });
      q.range = async (f: number) =>
        f > 0 ? { data: [], error: null } : t === "call_hides" ? { data: [{ id: "h1", phrase_id: "p1" }, { id: "h2", phrase_id: "p1" }], error: null } : t === "call_unhides" ? { data: [{ hide_id: "h2" }], error: null } : { data: [], error: null };
      if (t !== "profiles") q.then = (res: (v: unknown) => unknown) =>
        res(t === "call_hides" ? { data: [{ id: "h1", phrase_id: "p1" }, { id: "h2", phrase_id: "p1" }], error: null } : t === "call_unhides" ? { data: [{ hide_id: "h2" }], error: null } : { data: [], error: null });
      q.insert = (row: unknown) => {
        st.inserts.push({ t, row });
        const r: Record<string, unknown> = { select: () => r, maybeSingle: async () => ({ data: { id: "p-new" }, error: null }) };
        r.then = (res: (v: unknown) => unknown) => res({ error: null });
        return r;
      };
      return q;
    },
  }),
}));
import { GET, POST, DELETE } from "../route";

const req = (method: string, body?: unknown) => new Request("http://x", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }) as never;
const P1 = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  who.ctx = { userId: "adm", companyId: "co1", isAdmin: true };
  Object.assign(st, { inserts: [], audits: [], eqs: [], afters: [], scans: [], recentErr: null, phrase: { id: P1 } });
});

describe("hide phrases (0337)", () => {
  it("not an admin → 403 on every verb, nothing written", async () => {
    who.ctx = { userId: "m", companyId: "co1", isAdmin: false };
    expect(((await GET(req("GET"))) as Response).status).toBe(403);
    expect(((await POST(req("POST", { phrase: "personal call" }))) as Response).status).toBe(403);
    expect(((await DELETE(req("DELETE", { phraseId: P1 }))) as Response).status).toBe(403);
    expect(st.inserts).toEqual([]);
  });
  it("GET counts only hides that weren't unhidden", async () => {
    const j = (await ((await GET(req("GET"))) as Response).json()) as { phrases: Array<{ hiding: number }> };
    expect(j.phrases).toEqual([{ id: "p1", phrase: "personal call", hiding: 1 }]);
  });
  it("GET lists the hidden calls with the rep's name, even ones a retired phrase hid", async () => {
    const j = (await ((await GET(req("GET"))) as Response).json()) as { hiddenCalls: unknown[] };
    expect(j.hiddenCalls).toEqual([{ sessionId: "s9", label: "Acme", startedAt: "2026-11-20T10:00:00Z", rep: "Ana", phrases: ["retired phrase"] }]);
  });
  it("POST adds for the admin's company, audits, and checks recent calls for that phrase only, after the response", async () => {
    const r = (await POST(req("POST", { phrase: "  personal call " }))) as Response;
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ checking: 2 });
    expect(st.inserts[0]).toEqual({ t: "hide_phrases", row: { company_id: "co1", phrase: "personal call", created_by: "adm" } });
    expect(st.audits).toEqual([expect.objectContaining({ action: "call.hide_phrase_add" })]);
    expect(st.eqs).toContainEqual(["coaching_sessions", "company_id", "co1"]);
    expect(st.scans).toEqual([]);
    for (const f of st.afters) await f();
    expect(st.scans).toEqual([["s1", [{ id: "p-new", phrase: "personal call" }]], ["s2", [{ id: "p-new", phrase: "personal call" }]]]);
  });
  it("a failed recent-calls read says so (checking: null), not 'no calls'", async () => {
    st.recentErr = { message: "boom" };
    expect(await ((await POST(req("POST", { phrase: "personal call" }))) as Response).json()).toMatchObject({ checking: null });
  });
  it("a too-short phrase → 400", async () => {
    expect(((await POST(req("POST", { phrase: "ab" }))) as Response).status).toBe(400);
  });
  it("DELETE retires a phrase of this company (404 otherwise) and audits", async () => {
    st.phrase = null;
    expect(((await DELETE(req("DELETE", { phraseId: P1 }))) as Response).status).toBe(404);
    st.phrase = { id: P1 };
    expect(((await DELETE(req("DELETE", { phraseId: P1 }))) as Response).status).toBe(200);
    expect(st.inserts).toEqual([{ t: "hide_phrase_retirements", row: { phrase_id: P1, company_id: "co1", retired_by: "adm" } }]);
    expect(st.audits).toEqual([expect.objectContaining({ action: "call.hide_phrase_retire" })]);
  });
});
