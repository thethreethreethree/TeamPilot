import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/prospects — the Remote Sales pipeline (2026-11-23). Pinned: a prospect is created in ONE call to
 * rss_create_prospect (all or nothing); a call already in a pipeline is a 409; someone else's call is a 403 that says
 * why; a failed pipeline read is a 500, never an empty pipeline; ?repId is a uuid or "team".
 */
const st = vi.hoisted(() => ({
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcResult: { data: "p-new", error: null } as { data: unknown; error: { code?: string; message: string } | null },
  list: [] as unknown[] | null,
  listArg: "unset" as unknown,
}));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep-1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({ rpc: async (fn: string, args: Record<string, unknown>) => (st.rpc.push({ fn, args }), st.rpcResult) }),
}));
vi.mock("@/lib/coach/remote/prospects", () => ({
  listProspects: vi.fn(async (_db: unknown, repId: unknown) => ((st.listArg = repId), st.list)),
}));
vi.mock("@/lib/coach/remote/macroMode", () => ({ pipelineTotals: () => ({}) }));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const post = (body: unknown) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) }));
const get = (q = "") => GET(new NextRequest(`http://x/api${q}`));
const CALL = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  st.rpc = [];
  st.rpcResult = { data: "p-new", error: null };
  st.list = [];
  st.listArg = "unset";
});

describe("adding a prospect", () => {
  it("is one transaction carrying every first fact and the call", async () => {
    const res = await post({ name: "Pat", organization: "Acme", amount: 120, stageLabel: "Demo", nextCallDate: "2026-11-30", sessionId: CALL });
    expect(await res.json()).toEqual({ id: "p-new", linked: true });
    expect(st.rpc).toEqual([{ fn: "rss_create_prospect", args: { p_name: "Pat", p_organization: "Acme", p_amount: 120, p_stage_label: "Demo", p_next_call: "2026-11-30", p_session: CALL, p_source: null } }]);
  });

  it("carries the lead source in the same transaction (0313)", async () => {
    await post({ name: "Pat", source: " Webinar " });
    expect(st.rpc[0]).toMatchObject({ fn: "rss_create_prospect", args: { p_name: "Pat", p_source: "Webinar" } });
  });

  it("a call already in a pipeline → 409", async () => {
    st.rpcResult = { data: null, error: { code: "23505", message: "dup" } };
    expect((await post({ name: "Pat", sessionId: CALL })).status).toBe(409);
  });

  it("someone else's call → 403 that says only the call's rep can add it", async () => {
    st.rpcResult = { data: null, error: { code: "42501", message: "denied" } };
    const res = await post({ name: "Pat", sessionId: CALL });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/only the rep who took this call/i);
  });

  it("any other failure → 500, never a fake id", async () => {
    st.rpcResult = { data: null, error: { message: "boom" } };
    expect((await post({ name: "Pat" })).status).toBe(500);
  });

  it("a name is required", async () => {
    expect((await post({ name: "  " })).status).toBe(400);
    expect(st.rpc).toEqual([]);
  });
});

describe("reading the pipeline", () => {
  it("defaults to the caller's own; 'team' reads everything RLS allows", async () => {
    await get();
    expect(st.listArg).toBe("rep-1");
    await get("?repId=team");
    expect(st.listArg).toBeUndefined();
  });

  it("a repId that isn't a uuid is refused before any read", async () => {
    expect((await get("?repId=drop")).status).toBe(400);
    expect(st.listArg).toBe("unset");
  });

  it("a failed read is a 500, never an empty pipeline", async () => {
    st.list = null;
    expect((await get()).status).toBe(500);
  });
});
