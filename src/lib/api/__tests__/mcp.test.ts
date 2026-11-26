import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The MCP server (Engage plan E4; Gong F32.1). Pinned: the protocol handshake and tool list; a tool call is pinned to
 * the key's company; a deal from another company is "not found" (an error the assistant can read, not a crash); an
 * answer's references point only at real call lines.
 */
const st = vi.hoisted(() => ({ eqs: [] as Array<[string, string, unknown]>, deal: null as unknown, deals: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/publicApi", () => ({
  authenticateApiKey: vi.fn(async () => ({ keyId: "k", companyId: "co1", createdBy: "a", scopes: ["mcp"] })),
  recordApiUsage: vi.fn(async () => undefined),
  OUTSIDE_READER: "00000000-0000-0000-0000-000000000000",
}));
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenInCompanyFrom: vi.fn(async () => new Set()) }));
vi.mock("@/lib/coach/remote/revenue/dealCalls", () => ({ loadDealCalls: vi.fn(async () => ({ calls: [], linked: 0 })) }));
vi.mock("@/lib/claude", () => ({ mcpAskCoach: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "ilike", "in", "neq"]) q[m] = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([table, c, v]), q);
      q.maybeSingle = async () => ({ data: table === "remote_prospects_current" ? st.deal : null, error: null });
      q.then = (r: (v: unknown) => unknown) => r({ data: table === "remote_prospects_current" ? st.deals : [], error: null });
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
});

describe("MCP server", () => {
  it("initialize, then tools/list", async () => {
    const init = await (await rpc("initialize", { protocolVersion: "2025-03-26" })).json();
    expect(init.result).toMatchObject({ protocolVersion: "2025-03-26", serverInfo: { name: "elostate" }, capabilities: { tools: {} } });
    expect((await rpc("notifications/initialized")).status).toBe(202);
    const list = await (await rpc("tools/list")).json();
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(["list_deals", "get_deal", "get_account", "ask_deal"]);
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
