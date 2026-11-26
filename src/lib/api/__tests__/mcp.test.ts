import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The MCP server (Engage plan E4; Gong F32.1). Pinned: the protocol handshake and tool list; a tool call is pinned to
 * the key's company; a deal from another company is "not found" (an error the assistant can read, not a crash); an
 * answer's references point only at real call lines.
 */
const st = vi.hoisted(() => ({
  eqs: [] as Array<[string, string, unknown]>, deal: null as unknown, deals: [] as unknown[],
  hidden: new Set<string>(), sessions: [] as unknown[], loadedIds: null as string[] | null, account: null as unknown, links: [] as unknown[], dealCalls: { calls: [] as unknown[], linked: 0 }, briefArgs: null as unknown,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/publicApi", () => ({
  authenticateApiKey: vi.fn(async () => ({ keyId: "k", companyId: "co1", createdBy: "a", scopes: ["mcp"] })),
  recordApiUsage: vi.fn(async () => undefined),
  OUTSIDE_READER: "00000000-0000-0000-0000-000000000000",
}));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenInCompanyFrom: vi.fn(async () => st.hidden) }));
vi.mock("@/lib/coach/remote/revenue/dealCalls", () => ({ DEAL_CALLS: 5, DEAL_LINES: 900, loadDealCalls: vi.fn(async () => st.dealCalls), loadCallsByIds: vi.fn(async (_d: unknown, ids: string[]) => ((st.loadedIds = ids), (st.dealCalls.calls as Array<{ sessionId: string }>).filter((c) => ids.includes(c.sessionId)))) }));
vi.mock("@/lib/coach/remote/revenue/dealBriefRun", () => ({ writeDealBrief: vi.fn(async (_a: unknown, args: unknown) => ((st.briefArgs = args), { brief: { standing: "x", happened: [], risks: [], next: [] }, createdAt: "t", stored: false })) }));
vi.mock("@/lib/claude", () => ({ mcpAskCoach: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "ilike", "in", "neq", "gte"]) q[m] = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([table, c, v]), q);
      q.maybeSingle = async () => ({ data: table === "remote_prospects_current" ? st.deal : table === "accounts_current" ? st.account : null, error: null });
      q.then = (r: (v: unknown) => unknown) => r({ data: table === "remote_prospects_current" ? st.deals : table === "coaching_sessions" ? st.sessions : table === "remote_prospect_calls" ? st.links : [], error: null });
      return q;
    },
  }),
}));
import { POST } from "@/app/api/mcp/route";
import { resolveCallRefs } from "../mcpTools";
const rpc = (method: string, params?: unknown, id = 1) => POST(new Request("http://x/api/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) }));
beforeEach(() => {
  st.eqs = [];
  st.deal = null;
  st.deals = [];
  st.hidden = new Set();
  st.sessions = [];
  st.dealCalls = { calls: [], linked: 0 };
  st.briefArgs = null;
  st.loadedIds = null;
  st.links = [];
  st.account = null;
});

describe("MCP server", () => {
  it("initialize, then tools/list", async () => {
    const init = await (await rpc("initialize", { protocolVersion: "2025-03-26" })).json();
    expect(init.result).toMatchObject({ protocolVersion: "2025-03-26", serverInfo: { name: "elostate" }, capabilities: { tools: {} } });
    expect((await rpc("notifications/initialized")).status).toBe(202);
    const list = await (await rpc("tools/list")).json();
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(["list_deals", "get_deal", "get_account", "ask_deal", "ask_account", "generate_brief", "find_calls"]);
  });
  it("a tool call reads only the key's company", async () => {
    st.deals = [{ id: "d1", name: "Acme" }];
    const j = await (await rpc("tools/call", { name: "list_deals", arguments: { query: "ac" } })).json();
    expect(JSON.parse(j.result.content[0].text).deals).toEqual([{ id: "d1", name: "Acme" }]);
    expect(st.eqs).toContainEqual(["remote_prospects_current", "company_id", "co1"]);
  });
  it("a deal outside the company is a readable error, not a crash", async () => {
    const j = await (await rpc("tools/call", { name: "get_deal", arguments: { deal_id: "11111111-1111-4111-8111-111111111111" } })).json();
    expect(j.result.isError).toBe(true);
    expect(j.result.content[0].text).toMatch(/No deal/);
  });
  it("an unknown method is -32601", async () => {
    expect((await (await rpc("resources/list")).json()).error.code).toBe(-32601);
  });
  it("references point only at real lines", () => {
    const calls = [{ sessionId: "s1", startedAt: "2026-11-20", lines: [{ seq: 4, speaker: "customer", text: "x", atMs: 1000 }] }];
    expect(resolveCallRefs("Budget is set [C1:4] and [C1:9] and [C2:1].", calls)).toEqual([{ ref: "[C1:4]", sessionId: "s1", seq: 4, atMs: 1000 }]);
  });
});

describe("ask_account, generate_brief, find_calls (E4, completed 2026-11-27)", () => {
  const D = "11111111-1111-4111-8111-111111111111";
  const call = (id: string, startedAt: string, n = 3) => ({ sessionId: id, startedAt, version: 1, lines: Array.from({ length: n }, (_, i) => ({ seq: i + 1, speaker: "customer", text: "x", atMs: null })) });
  it("find_calls is pinned to the company and leaves out hidden calls and non-sales sessions", async () => {
    st.sessions = [{ id: "s1", agent_id: "r", context: "phone", started_at: "2026-11-20T00:00:00Z" }, { id: "s2", agent_id: "r", context: "video", started_at: "2026-11-19T00:00:00Z" }, { id: "s3", agent_id: "r", context: "phone", session_kind: "meeting", started_at: "2026-11-18T00:00:00Z" }];
    st.hidden = new Set(["s2"]);
    const j = await (await rpc("tools/call", { name: "find_calls", arguments: {} })).json();
    expect(JSON.parse(j.result.content[0].text).calls.map((c: { id: string }) => c.id)).toEqual(["s1"]);
    expect(st.eqs).toContainEqual(["coaching_sessions", "company_id", "co1"]);
  });
  it("find_calls refuses a malformed date with a readable error", async () => {
    const j = await (await rpc("tools/call", { name: "find_calls", arguments: { since: "last week" } })).json();
    expect(j.result.isError).toBe(true);
  });
  it("generate_brief briefs from the calls with no hide (left out before the newest are chosen), recorded as the key's creator", async () => {
    st.deal = { id: D, name: "Acme", status: "open" };
    st.dealCalls = { calls: [call("s1", "2026-11-20"), call("s2", "2026-11-19")], linked: 2 };
    st.links = [{ session_id: "s1" }, { session_id: "s2" }];
    st.hidden = new Set(["s2"]);
    const j = await (await rpc("tools/call", { name: "generate_brief", arguments: { deal_id: D } })).json();
    expect(JSON.parse(j.result.content[0].text).brief.standing).toBe("x");
    expect(st.loadedIds).toEqual(["s1"]);
    expect(st.briefArgs).toMatchObject({ companyId: "co1", actorId: "a", calls: [{ sessionId: "s1" }] });
  });
  it("generate_brief on a deal whose only call is hidden writes nothing", async () => {
    st.deal = { id: D, name: "Acme", status: "open" };
    st.dealCalls = { calls: [call("s2", "2026-11-19")], linked: 1 };
    st.links = [{ session_id: "s2" }];
    st.hidden = new Set(["s2"]);
    const j = await (await rpc("tools/call", { name: "generate_brief", arguments: { deal_id: D } })).json();
    expect(j.result.isError).toBe(true);
    expect(st.briefArgs).toBeNull();
  });
  it("ask_account loads transcripts only for the account's calls with no hide", async () => {
    st.deals = [{ id: "d1" }, { id: "d2" }];
    st.links = [{ session_id: "s1" }, { session_id: "s2" }, { session_id: "s3" }];
    st.hidden = new Set(["s2"]);
    st.account = { id: D, name: "Acme" };
    const j = await (await rpc("tools/call", { name: "ask_account", arguments: { account_id: D, question: "What matters to them?" } })).json();
    expect(st.loadedIds).toEqual(["s1", "s3"]);
    expect(JSON.parse(j.result.content[0].text).answer).toMatch(/no call transcripts/);
  });
});
