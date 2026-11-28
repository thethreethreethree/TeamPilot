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
  version: 1,
  link: { prospect_id: "d1" } as unknown,
}));
vi.mock("server-only", () => ({}));
vi.mock("../../webhooks", () => ({ webhooksConfigured: () => true }));
vi.mock("../../revenue/dealBriefRun", () => ({ writeDealBrief: vi.fn() }));
vi.mock("../../revenue/dealCalls", () => ({
  // Honours `exclude` the way the real loader does: dropped before the newest are picked.
  loadDealCalls: vi.fn(async (_db: unknown, _id: string, opts?: { exclude?: (ids: string[]) => Promise<Set<string>> }) => {
    const drop = opts?.exclude ? await opts.exclude(st.calls.map((c) => c.sessionId)) : new Set<string>();
    const calls = st.calls.filter((c) => !drop.has(c.sessionId));
    return { calls, linked: st.calls.length };
  }),
}));
vi.mock("../../hidePhrases", () => ({ hiddenFrom: vi.fn(async (_a: unknown, ids: string[]) => new Set(ids.filter((i) => st.hidden.has(i)))) }));
vi.mock("../../revenue/playbookReview", () => ({ reviewPlaybook: vi.fn(async (_a: unknown, args: unknown) => (st.reviewed.push(args), st.review)) }));
const admin = {
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "is", "limit", "order"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => (st.eqs.push([table, c, v]), q);
    q.maybeSingle = async () => ({ data: table === "remote_prospects_current" ? { id: "d1", name: "Acme", rep_id: "rep-1", status: "open", stage_label: null } : table === "remote_prospect_calls" ? st.link : null, error: null });
    q.then = (r: (v: unknown) => unknown) => r({ data: table === "agents" ? st.agents : table === "coaching_transcript_segments_current" ? (st.version ? [{ version: st.version }] : []) : [], error: null });
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
import { callLinkedFireKey, fireCallLinkedOnTranscript, runAgent, runAgentsForCallLinked } from "../agents";

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
  st.version = 1;
  st.link = { prospect_id: "d1" };
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
  it("a claim that fails is recorded on that agent and the next agent still runs (review 2026-11-28)", async () => {
    st.agents = [agent("bad"), agent("good")];
    const realFrom = (admin as unknown as { from: (t: string) => Record<string, unknown> }).from;
    const failing = { ...(admin as object), from: (t: string) => {
      const q = realFrom(t);
      if (t === "agent_fires") q.insert = async (row: Record<string, unknown>) => (row.agent_id === "bad" ? { error: { code: "XX000", message: "boom" } } : { error: null });
      return q;
    } } as never;
    await runAgentsForCallLinked(failing, { companyId: "co1", prospectId: "d1", sessionId: "s1" });
    expect(st.runs).toEqual([expect.objectContaining({ agent_id: "bad", ok: false }), expect.objectContaining({ agent_id: "good", ok: true })]);
  });
  it("a call linked before its transcript waits, runs once when it lands, and never again on a reprocess (review 2026-11-28)", async () => {
    st.agents = [agent("a1")];
    st.version = 0;
    await runAgentsForCallLinked(admin, { companyId: "co1", prospectId: "d1", sessionId: "s1" });
    expect(st.runs).toEqual([]);
    st.version = 1;
    await fireCallLinkedOnTranscript(admin, { companyId: "co1", sessionId: "s1" });
    expect(st.runs).toEqual([expect.objectContaining({ agent_id: "a1", fire_key: callLinkedFireKey("d1", "s1") })]);
    // a trim, relabel or reapply makes v2 and reprocesses: the claim is taken — no second notification or to-do
    st.version = 2;
    await fireCallLinkedOnTranscript(admin, { companyId: "co1", sessionId: "s1" });
    expect(st.runs).toHaveLength(1);
  });
  it("a call on no deal runs nothing when its transcript lands", async () => {
    st.agents = [agent("a1")];
    st.link = null;
    await fireCallLinkedOnTranscript(admin, { companyId: "co1", sessionId: "s1" });
    expect(st.runs).toEqual([]);
  });
});
