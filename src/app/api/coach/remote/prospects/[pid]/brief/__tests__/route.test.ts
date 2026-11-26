import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/prospects/:pid/brief (0374; Gong F20.3, F20.4). Pinned: once per basis (the same calls and versions
 * return the stored brief without an AI call); a changed basis reads as stale; suppressed / unusable / no calls say so
 * and store nothing; the deal is opened through the caller's client first.
 */
const st = vi.hoisted(() => ({
  deal: { id: "d1", company_id: "co1" } as unknown,
  latest: null as unknown,
  stored: null as unknown,
  dealCalls: { calls: [{ sessionId: "s1", startedAt: "2026-11-20T10:00:00Z", version: 2, lines: [{ seq: 1, speaker: "customer", text: "March.", atMs: 1000 }] }], linked: 1 } as unknown,
  ai: { text: "" } as { text: string; suppressed?: boolean },
  aiCalls: 0,
  inserts: [] as unknown[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/coach/remote/revenue/dealCalls", () => ({ loadDealCalls: vi.fn(async () => st.dealCalls) }));
vi.mock("@/lib/claude", () => ({ dealBriefCoach: vi.fn(async () => (st.aiCalls++, st.ai)) }));
const q = (table: string) => {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: table === "remote_prospects" ? st.deal : table === "deal_briefs" ? (st.latest ?? st.stored) : null, error: null });
  b.insert = async (row: unknown) => (st.inserts.push(row), (st.stored = { brief: (row as { brief: unknown }).brief, created_at: "now" }), { error: null });
  return b;
};
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({ from: q }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: q }) }));

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
const P = { params: Promise.resolve({ pid: "11111111-1111-4111-8111-111111111111" }) };
const run = () => POST(new NextRequest("http://x/api", { method: "POST" }), P);
const good = JSON.stringify({ standing: "Wants March.", happened: [{ text: "Set a March deadline.", cites: [{ call: 1, seq: 1 }] }], risks: [], next: [] });

beforeEach(() => {
  st.latest = null;
  st.stored = null;
  st.ai = { text: good };
  st.aiCalls = 0;
  st.inserts = [];
});

describe("the deal brief", () => {
  it("writes once per basis, storing a cited brief", async () => {
    const j = await (await run()).json();
    expect(j.brief.happened[0].cites[0]).toEqual({ sessionId: "s1", seq: 1, atMs: 1000 });
    expect(st.inserts).toEqual([expect.objectContaining({ prospect_id: "11111111-1111-4111-8111-111111111111", basis: "s1:2", company_id: "co1" })]);
    await run();
    expect(st.aiCalls).toBe(1); // the second run returned the stored one
  });
  it("a brief on an older basis reads as stale", async () => {
    st.latest = { basis: "s1:1", brief: { standing: "", happened: [], risks: [], next: [] }, created_at: "t" };
    expect(await (await GET(new NextRequest("http://x/api"), P)).json()).toMatchObject({ stale: true });
    st.latest = { basis: "s1:2", brief: { standing: "", happened: [], risks: [], next: [] }, created_at: "t" };
    expect(await (await GET(new NextRequest("http://x/api"), P)).json()).toMatchObject({ stale: false });
  });
  it("suppressed (409) or unusable (502) store nothing", async () => {
    st.ai = { text: "", suppressed: true };
    expect((await run()).status).toBe(409);
    st.ai = { text: "not json" };
    expect((await run()).status).toBe(502);
    expect(st.inserts).toEqual([]);
  });
  it("no linked calls → says to link them (409); a deal the caller can't see → 404", async () => {
    const keep = st.dealCalls;
    st.dealCalls = { calls: [], linked: 0 };
    expect((await run()).status).toBe(409);
    st.dealCalls = keep;
    const d = st.deal;
    st.deal = null;
    expect((await run()).status).toBe(404);
    st.deal = d;
  });
});
