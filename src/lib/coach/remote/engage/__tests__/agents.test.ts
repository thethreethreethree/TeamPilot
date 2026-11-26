import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Agents (0379; Gong F27.3–F27.6). Pinned: a trigger matches on every part it names; an agent acts only on a deal its
 * owner can see; a test run changes nothing; each action's result is recorded.
 */
const st = vi.hoisted(() => ({ canSee: true, deal: { id: "d1", name: "Acme", rep_id: "rep-1", status: "open", stage_label: "Proposal" } as unknown, inserts: [] as Array<{ table: string; row: unknown }> }));
vi.mock("server-only", () => ({}));
const wh = vi.hoisted(() => ({ on: true }));
vi.mock("../../webhooks", () => ({ webhooksConfigured: () => wh.on }));
vi.mock("../../revenue/dealCalls", () => ({ loadDealCalls: vi.fn(async () => ({ calls: [], linked: 0 })) }));
vi.mock("../../revenue/dealBriefRun", () => ({ writeDealBrief: vi.fn() }));
const hid = vi.hoisted(() => ({ set: new Set<string>() }));
vi.mock("../../hidePhrases", () => ({ hiddenFrom: vi.fn(async () => hid.set) }));
import { fireTrackerAgents, firstHeard, runAgent, runAgentsForTrackers, stageChanged, triggerMatches } from "../agents";
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
  hid.set = new Set();
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
    // No customer name in the payload erasure can't reach (0381's check refuses one).
    expect((st.inserts[0]!.row as { payload: Record<string, unknown> }).payload).not.toHaveProperty("deal_name");
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

describe("review fixes (2026-11-27)", () => {
  const tAgent = { ...agent, id: "a2", trigger: { kind: "tracker_heard" as const, tracker_id: "t1" }, actions: [{ kind: "notify" as const, to: "owner" as const }] };
  const scanDb = (done: Array<{ agent_id: string; tracker_id: string }>) => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "limit", "contains", "lt", "in"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: table === "remote_prospect_calls" ? { prospect_id: "d1" } : table === "remote_prospects_current" ? st.deal : null, error: null });
      q.then = (r: (v: unknown) => unknown) => r({ data: table === "agents" ? [tAgent] : table === "agent_runs" ? done : [], error: null });
      q.insert = (row: unknown) => (st.inserts.push({ table, row }), Promise.resolve({ error: null }));
      return q;
    },
    rpc: async () => ({ data: true, error: null }),
  }) as never;
  it("a tracker agent fires once per call: a rescan of the same call does nothing", async () => {
    await runAgentsForTrackers(scanDb([]), { companyId: "co1", sessionId: "s1", trackerIds: ["t1"] });
    expect(st.inserts.map((i) => i.table)).toEqual(["manager_notifications", "agent_runs"]);
    expect(st.inserts[1]!.row).toMatchObject({ session_id: "s1", tracker_id: "t1" });
    st.inserts = [];
    await runAgentsForTrackers(scanDb([{ agent_id: "a2", tracker_id: "t1" }]), { companyId: "co1", sessionId: "s1", trackerIds: ["t1"] });
    expect(st.inserts).toEqual([]);
  });
  it("a call hidden from the agent's owner never fires their agent", async () => {
    hid.set = new Set(["s1"]);
    await runAgentsForTrackers(scanDb([]), { companyId: "co1", sessionId: "s1", trackerIds: ["t1"] });
    expect(st.inserts).toEqual([]);
  });
  it("a stage save fires agents only when the stage changes", () => {
    expect(stageChanged({ status: "open", stage_label: "Proposal" }, { status: "open", label: " proposal" })).toBe(false);
    expect(stageChanged({ status: "open", stage_label: "Proposal" }, { status: "won", label: "Proposal" })).toBe(true);
    expect(stageChanged({ status: "open", stage_label: null }, { status: "open", label: "Demo" })).toBe(true);
    expect(stageChanged(null, { status: "open", label: null })).toBe(true);
  });
  it("a claimed fire: a lost claim does nothing and records nothing; a won claim records the fire key", async () => {
    const lost = await runAgent(admin, agent, "d1", false, { fireKey: "close:d1:2026-12-01:7", claim: async () => false });
    expect(lost.acted).toBe(false);
    expect(st.inserts).toEqual([]);
    const won = await runAgent(admin, agent, "d1", false, { fireKey: "close:d1:2026-12-01:7", claim: async () => true });
    expect(won.acted).toBe(true);
    expect(st.inserts.at(-1)!.row).toMatchObject({ fire_key: "close:d1:2026-12-01:7" });
  });
  it("a failure before the claim doesn't use up the fire (recorded without the key; no claim made)", async () => {
    st.canSee = false;
    const claim = vi.fn(async () => true);
    const r = await runAgent(admin, agent, "d1", false, { fireKey: "close:d1:2026-12-01:7", claim });
    expect(claim).not.toHaveBeenCalled();
    expect(r.acted).toBe(false);
    expect(st.inserts.at(-1)!.row).not.toHaveProperty("fire_key");
  });
  it("a webhook queued while sending is off says nothing is sent (not 'queued' as if it will go)", async () => {
    wh.on = false;
    const hookAgent = { ...agent, actions: [{ kind: "webhook" as const }] };
    const db = {
      from: (table: string) => {
        const q: Record<string, unknown> = {};
        for (const m of ["select", "eq", "is", "limit", "contains"]) q[m] = () => q;
        q.maybeSingle = async () => ({ data: table === "remote_prospects_current" ? st.deal : null, error: null });
        q.then = (r: (v: unknown) => unknown) => r({ data: table === "webhook_endpoints" ? [{ id: "ep1" }] : [], error: null });
        q.insert = (row: unknown) => (st.inserts.push({ table, row }), Promise.resolve({ error: null }));
        return q;
      },
      rpc: async () => ({ data: true, error: null }),
    } as never;
    const r = await runAgent(db, hookAgent, "d1", false);
    expect(r.results[0]).toMatchObject({ kind: "webhook", ok: false });
    expect(r.results[0]!.detail).toMatch(/nothing is sent/);
    wh.on = true;
  });
});
