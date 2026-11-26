import { describe, it, expect, vi, beforeEach } from "vitest";

/** Vocabulary on past calls (F8.9, founder picker 2026-11-26): a count first; fixing writes new versions, then redoes AI. */
const st = vi.hoisted(() => ({
  admin: true,
  corrections: [{ term: "Spectrum", heard: ["spec trum"] }] as unknown,
  lines: [
    { id: 1, session_id: "s1", seq: 1, text: "we left spec trum", version: 2 },
    { id: 2, session_id: "s1", seq: 2, text: "fine", version: 2 },
    { id: 3, session_id: "s2", seq: 1, text: "nothing here", version: 1 },
  ],
  rpcs: [] as unknown[],
  rpcResult: 3 as number,
  audits: [] as unknown[],
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "a1", companyId: "co1", isAdmin: st.admin })) }));
vi.mock("@/lib/coach/remote/vocabulary", async (orig) => ({ ...(await orig<typeof import("@/lib/coach/remote/vocabulary")>()), readCompanyCorrections: vi.fn(async () => st.corrections) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async (_db: unknown, a: unknown) => st.audits.push(a)) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => null), getSessionTranscript: vi.fn(async () => []) }));
vi.mock("@/lib/coach/v5/generateSessionArtifacts", () => ({ generateSessionArtifacts: vi.fn() }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (_fn: string, args: unknown) => (st.rpcs.push(args), { data: st.rpcResult, error: null }),
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "neq", "gte", "order"]) q[m] = () => q;
      q.limit = async () => ({ data: [{ id: "s1" }, { id: "s2" }], error: null });
      q.range = async (from: number) => ({ data: from > 0 || t !== "coaching_transcript_segments_current" ? [] : st.lines, error: null });
      return q;
    },
  }),
}));
import { POST } from "../route";
const post = (body: unknown) => POST(new Request("http://t/x", { method: "POST", body: JSON.stringify(body) }) as never);
beforeEach(() => {
  st.admin = true;
  st.corrections = [{ term: "Spectrum", heard: ["spec trum"] }];
  st.rpcs = [];
  st.rpcResult = 3;
  st.audits = [];
});

describe("vocabulary re-apply", () => {
  it("the count writes nothing", async () => {
    expect(await (await post({})).json()).toMatchObject({ calls: 1, lines: 1, scanned: 2, batch: 1 });
    expect(st.rpcs).toEqual([]);
  });
  it("fixing writes a new version of each changed call from its current version, audited", async () => {
    const body = await (await post({ apply: true })).json();
    expect(body).toMatchObject({ fixed: 1, skipped: 0, remaining: 0 });
    expect(st.rpcs).toEqual([{ p_session_id: "s1", p_from_version: 2, p_texts: { "1": "we left Spectrum" } }]);
    expect(st.audits[0]).toMatchObject({ action: "vocabulary.reapply", meta: { fixed: 1 } });
  });
  it("a call changed in between is skipped, not overwritten; no corrections or not an admin is refused", async () => {
    st.rpcResult = -1;
    expect(await (await post({ apply: true })).json()).toMatchObject({ fixed: 0, skipped: 1 });
    st.corrections = [];
    expect((await post({})).status).toBe(400);
    st.corrections = null;
    expect((await post({})).status).toBe(500);
    st.admin = false;
    expect((await post({})).status).toBe(403);
  });
});
