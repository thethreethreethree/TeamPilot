import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Agents (0379; Gong F27.3–F27.6). Pinned: a trigger matches on every part it names; an agent acts only on a deal its
 * owner can see; a test run changes nothing; each action's result is recorded.
 */
const st = vi.hoisted(() => ({ canSee: true, deal: { id: "d1", name: "Acme", rep_id: "rep-1", status: "open", stage_label: "Proposal" } as unknown, inserts: [] as Array<{ table: string; row: unknown }> }));
vi.mock("server-only", () => ({}));
vi.mock("../../revenue/dealCalls", () => ({ loadDealCalls: vi.fn(async () => ({ calls: [], linked: 0 })) }));
vi.mock("../../revenue/dealBriefRun", () => ({ writeDealBrief: vi.fn() }));
vi.mock("../../hidePhrases", () => ({ hiddenFrom: vi.fn(async () => new Set()) }));
import { fireTrackerAgents, firstHeard, runAgent, triggerMatches } from "../agents";
const admin = {
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "limit", "contains"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: table === "remote_prospects_current" ? st.deal : table === "profiles" ? { full_name: "Rep" } : null, error: null });
    q.then = (r: (v: unknown) => unknown) => r({ data: [], error: null });
    q.insert = (row: unknown) => {
      st.inserts.push({ table, row });
      return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => ({ data: { id: "t1" }, error: null }) }) });
    };
    return q;
  },
  rpc: async () => ({ data: st.canSee, error: null }),
} as never;
const agent = { id: "a1", company_id: "co1", owner_id: "mgr", name: "Proposal prep", trigger: { kind: "deal_stage" as const, label: "Proposal" }, actions: [{ kind: "notify" as const, to: "rep" as const }, { kind: "todo" as const, title: "Send the proposal", due_days: 2 }] };
beforeEach(() => {
  st.canSee = true;
  st.inserts = [];
});

describe("agents", () => {
  it("a trigger matches on every part it names; stage names ignore case", () => {
    expect(triggerMatches({ kind: "deal_stage", label: "Proposal" }, { status: "open", label: "proposal " })).toBe(true);
    expect(triggerMatches({ kind: "deal_stage", status: "won" }, { status: "open", label: "Won" })).toBe(false);
    expect(triggerMatches({ kind: "deal_stage", status: "won", label: "Signed" }, { status: "won", label: "Signed" })).toBe(true);
    expect(triggerMatches({ kind: "deal_stage", status: "won", label: "Signed" }, { status: "won", label: "Other" })).toBe(false);
    expect(triggerMatches({ kind: "deal_stage" }, { status: "won", label: null })).toBe(false);
  });
  it("acts in order and records each result", async () => {
    const r = await runAgent(admin, agent, "d1", false);
    expect(r.ok).toBe(true);
    expect(r.results.map((x) => x.kind)).toEqual(["notify", "todo"]);
    expect(st.inserts.map((i) => i.table)).toEqual(["manager_notifications", "tasks", "remote_prospect_tasks", "agent_runs"]);
    expect(st.inserts[0]!.row).toMatchObject({ recipient_id: "rep-1", type: "agent_ran" });
  });
  it("an owner who can't see the deal: nothing is done, and the run says why", async () => {
    st.canSee = false;
    const r = await runAgent(admin, agent, "d1", false);
    expect(r.ok).toBe(false);
    expect(r.skipped).toMatch(/can't see/);
    expect(st.inserts.map((i) => i.table)).toEqual(["agent_runs"]);
  });
  it("a test run changes nothing but says what it would do", async () => {
    const r = await runAgent(admin, agent, "d1", true);
    expect(r.results.map((x) => x.detail)).toEqual(["Would notify the deal's rep.", "Would add the to-do “Send the proposal”."]);
    expect(st.inserts.map((i) => i.table)).toEqual(["agent_runs"]);
    expect(st.inserts[0]!.row).toMatchObject({ test: true });
  });
});

describe("the tracker trigger (0380)", () => {
  it("only trackers with no hit in an earlier transcript version count as first heard", async () => {
    const db = { from: () => { const q: Record<string, unknown> = {}; for (const m of ["select", "eq", "lt", "in", "limit"]) q[m] = () => q; q.then = (r: (v: unknown) => unknown) => r({ data: [{ tracker_id: "t1" }], error: null }); return q; } } as never;
    expect(await firstHeard(db, "co1", "s1", 3, ["t1", "t2", "t2"])).toEqual(["t2"]);
    expect(await firstHeard(db, "co1", "s1", 3, [])).toEqual([]);
  });
  it("never throws into the scan that stored the hits", async () => {
    const broken = { from: () => { throw new Error("boom"); } } as never;
    await expect(fireTrackerAgents(broken, { companyId: "co1", sessionId: "s1", version: 1, heard: ["t1"] })).resolves.toBeUndefined();
  });
  it("a stage change never fires a tracker agent", () => {
    expect(triggerMatches({ kind: "tracker_heard", tracker_id: "t1" }, { status: "won", label: null })).toBe(false);
  });
});
