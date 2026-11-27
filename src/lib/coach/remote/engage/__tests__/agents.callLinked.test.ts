import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Fill the playbook from each call (0392, Engage E12; Gong F27.10). Pinned: a linked call runs the company's call-linked
 * agents once per agent, deal and call (the claim); a call hidden from the agent's owner never runs it; the playbook
 * action reads only the calls the owner may hear, through the one reviewer (reviewPlaybook), pinned to the company; a
 * company with no playbook is said, not failed; a test run reads nothing.
 */
const st = vi.hoisted(() => ({
  agents: [] as unknown[],
  claims: new Set<string>(),
  runs: [] as unknown[],
  eqs: [] as Array<[string, string, unknown]>,
  calls: [] as Array<{ sessionId: string; startedAt: string; lines: unknown[] }>,
  hidden: new Set<string>(),
  review: { found: 2, of: 3, calls: 1 } as unknown,
  reviewed: [] as unknown[],
}));
vi.mock("server-only", () => ({}));
vi.mock("../../webhooks", () => ({ webhooksConfigured: () => true }));
vi.mock("../../revenue/dealBriefRun", () => ({ writeDealBrief: vi.fn() }));
vi.mock("../../revenue/dealCalls", () => ({ loadDealCalls: vi.fn(async () => ({ calls: st.calls, linked: st.calls.length })) }));
vi.mock("../../hidePhrases", () => ({ hiddenFrom: vi.fn(async (_a: unknown, ids: string[]) => new Set(ids.filter((i) => st.hidden.has(i)))) }));
vi.mock("../../revenue/playbookReview", () => ({ reviewPlaybook: vi.fn(async (_a: unknown, args: unknown) => (st.reviewed.push(args), st.review)) }));
const admin = {
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "is", "limit", "order"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => (st.eqs.push([table, c, v]), q);
    q.maybeSingle = async () => ({ data: table === "remote_prospects_current" ? { id: "d1", name: "Acme", rep_id: "rep-1", status: "open", stage_label: null } : null, error: null });
    q.then = (r: (v: unknown) => unknown) => r({ data: table === "agents" ? st.agents : [], error: null });
    q.insert = async (row: Record<string, unknown>) => {
      if (table === "agent_fires") {
        const k = `${row.agent_id}|${row.fire_key}`;
        if (st.claims.has(k)) return { error: { code: "23505", message: "dup" } };
        st.claims.add(k);
        return { error: null };
      }
      if (table === "agent_runs") st.runs.push(row);
      return { error: null };
    };
    return q;
  },
  rpc: async () => ({ data: true, error: null }),
} as never;
import { callLinkedFireKey, runAgent, runAgentsForCallLinked } from "../agents";

const agent = (id: string, kind = "call_linked") => ({ id, company_id: "co1", owner_id: "mgr", name: "Fill", trigger: { kind }, actions: [{ kind: "playbook" }] });
beforeEach(() => {
  st.agents = [];
  st.claims = new Set();
  st.runs = [];
  st.eqs = [];
  st.calls = [{ sessionId: "s1", startedAt: "2026-11-27T00:00:00Z", lines: [] }, { sessionId: "s2", startedAt: "2026-11-26T00:00:00Z", lines: [] }];
  st.hidden = new Set();
  st.review = { found: 2, of: 3, calls: 1 };
  st.reviewed = [];
});

describe("the call-linked trigger (0392)", () => {
  it("runs the company's call-linked agents once per deal and call; other triggers don't run", async () => {
    st.agents = [agent("a1"), agent("a2", "deal_gone_quiet")];
    await runAgentsForCallLinked(admin, { companyId: "co1", prospectId: "d1", sessionId: "s1" });
    expect(st.runs).toEqual([expect.objectContaining({ agent_id: "a1", prospect_id: "d1", session_id: "s1", fire_key: callLinkedFireKey("d1", "s1"), ok: true })]);
    expect(st.eqs).toContainEqual(["agents", "company_id", "co1"]);
    // the same link seen again (a retry): the claim is taken, nothing runs
    st.runs = [];
    await runAgentsForCallLinked(admin, { companyId: "co1", prospectId: "d1", sessionId: "s1" });
    expect(st.runs).toEqual([]);
  });
  it("a call hidden from the agent's owner never runs it", async () => {
    st.agents = [agent("a1")];
    st.hidden = new Set(["s1"]);
    await runAgentsForCallLinked(admin, { companyId: "co1", prospectId: "d1", sessionId: "s1" });
    expect(st.runs).toEqual([]);
    expect(st.reviewed).toEqual([]);
  });
});

describe("the playbook action (0392)", () => {
  it("reads only the calls the owner may hear, through the one reviewer, pinned to the company", async () => {
    st.hidden = new Set(["s2"]);
    const r = await runAgent(admin, agent("a1") as never, "d1", false);
    expect(r.results).toEqual([{ kind: "playbook", ok: true, detail: "Read the playbook: evidence for 2 of 3 elements." }]);
    expect(st.reviewed).toEqual([expect.objectContaining({ companyId: "co1", prospectId: "d1", actorId: "mgr", calls: [expect.objectContaining({ sessionId: "s1" })] })]);
  });
  it("no playbook is said, not failed; a failed review is a failure; a test run reads nothing", async () => {
    st.review = "no_playbook";
    expect((await runAgent(admin, agent("a1") as never, "d1", false)).results[0]).toMatchObject({ ok: true, detail: expect.stringMatching(/no playbook/) });
    st.review = "failed";
    expect((await runAgent(admin, agent("a1") as never, "d1", false)).results[0]).toMatchObject({ ok: false });
    st.reviewed = [];
    expect((await runAgent(admin, agent("a1") as never, "d1", true)).results[0]).toMatchObject({ ok: true, detail: "Would read the playbook from the deal's calls." });
    expect(st.reviewed).toEqual([]);
  });
});
