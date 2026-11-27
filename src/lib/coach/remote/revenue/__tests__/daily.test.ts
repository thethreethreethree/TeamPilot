import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The nightly revenue job (0382). Pinned: only open deals are recorded, with dealRisk's verdict; the company is passed
 * to the pinned reader; a company whose read fails is counted and nothing is written for it; a close-date agent fires
 * on deals inside its window, once per deal and close date.
 */
const st = vi.hoisted(() => ({ companies: [{ id: "co1", timezone: "UTC" }, { id: "co2", timezone: null }] as unknown[], doneCount: 0, claims: [] as unknown[], claimSet: new Set<string>(), stored: [] as unknown[], dupOnce: false, deals: {} as Record<string, unknown[] | null>, upserts: [] as unknown[][], runs: [] as unknown[], agents: [] as unknown[], ran: [] as unknown[], asked: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("../../prospects", () => ({ listProspects: vi.fn(async (_db: unknown, _r: unknown, o: { companyId: string }) => (st.asked.push(o), o.companyId in st.deals ? st.deals[o.companyId] : [])) }));
vi.mock("../../engage/agents", () => ({
  runAgent: vi.fn(async (_a: unknown, agent: { id: string }, pid: string, test: boolean, on: { fireKey: string; claim: () => Promise<boolean> }) => {
    if (!(await on.claim())) return { ok: true, skipped: "Already done", results: [], acted: false };
    st.ran.push({ agent: agent.id, pid, test, fireKey: on.fireKey });
    return { ok: true, skipped: null, results: [], acted: true };
  }),
}));
import { closeDateFires, closeFireKey, dayIn, quietFireKey, quietFires, runRevenueDaily, snapshotRows } from "../daily";

const DAY = "2026-11-27";
const NOW = new Date("2026-11-27T12:00:00Z");
const deal = (id: string, o: Record<string, unknown> = {}) => ({ id, repId: "r1", name: id, status: "open", amount: 100, nextCallDate: "2026-12-01", closeDate: null, lastCallAt: "2026-11-26T00:00:00Z", createdAt: "2026-11-25T00:00:00Z", nextTodo: null, ...o });
const admin = {
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "eq", "is", "in", "like", "limit"]) q[m] = () => q;
    q.range = (f: number) => Promise.resolve({ data: f > 0 ? [] : table === "companies" ? st.companies : table === "agents" ? st.agents : table === "agent_fires" ? st.claims : table === "deal_warning_snapshots" ? st.stored : [], error: null });
    // the "already recorded today?" count
    q.then = (r: (v: unknown) => unknown) => r({ data: null, count: table === "deal_warning_snapshots" ? st.doneCount : 0, error: null });
    q.insert = async (rows: unknown) => {
      if (table === "agent_fires") {
        const k = `${(rows as { agent_id: string }).agent_id}|${(rows as { fire_key: string }).fire_key}`;
        if (st.claimSet.has(k)) return { error: { code: "23505", message: "dup" } };
        st.claimSet.add(k);
        return { error: null };
      }
      if (st.dupOnce && Array.isArray(rows)) {
        st.dupOnce = false;
        return { error: { code: "23505", message: "dup" } };
      }
      st.upserts.push(Array.isArray(rows) ? rows : [rows]);
      return { error: null };
    };
    return q;
  },
} as never;
beforeEach(() => {
  st.deals = {};
  st.companies = [{ id: "co1", timezone: "UTC" }, { id: "co2", timezone: null }];
  st.doneCount = 0;
  st.claims = [];
  st.claimSet = new Set();
  st.stored = [];
  st.dupOnce = false;
  st.upserts = [];
  st.runs = [];
  st.agents = [];
  st.ran = [];
  st.asked = [];
});

describe("snapshotRows", () => {
  it("records open deals only, with dealRisk's level and reasons", () => {
    const rows = snapshotRows("co1", DAY, [deal("a", { nextCallDate: null }), deal("b", { status: "won" })] as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ company_id: "co1", day: DAY, prospect_id: "a", rep_id: "r1" });
    expect(rows[0]!.reasons).toContain("no_next_call");
  });
});

describe("closeDateFires", () => {
  const agent = { id: "ag", company_id: "co1", owner_id: "m", name: "Close soon", trigger: { kind: "close_date_near" as const, days: 7 }, actions: [] };
  it("fires on open deals closing within the window, not before today or past it, not twice", () => {
    const deals = [deal("in", { closeDate: "2026-12-03" }), deal("edge", { closeDate: "2026-12-04" }), deal("late", { closeDate: "2026-12-05" }), deal("past", { closeDate: "2026-11-26" }), deal("won", { status: "won", closeDate: "2026-12-01" })] as never;
    expect(closeDateFires([agent], deals, DAY, new Set()).map((f) => f.prospectId)).toEqual(["in", "edge"]);
    const fired = new Set([`ag|${closeFireKey("in", "2026-12-03", 7)}`]);
    expect(closeDateFires([agent], deals, DAY, fired).map((f) => f.prospectId)).toEqual(["edge"]);
  });
  it("other triggers never fire here", () => {
    expect(closeDateFires([{ ...agent, trigger: { kind: "deal_stage", status: "won" } }] as never, [deal("in", { closeDate: "2026-12-03" })] as never, DAY, new Set())).toEqual([]);
  });
});

describe("quietFires (0389, E8)", () => {
  const agent = { id: "aq", company_id: "co1", owner_id: "m", name: "Gone quiet", trigger: { kind: "deal_gone_quiet" as const }, actions: [] };
  it("fires on open deals dealRisk calls gone quiet, once per quiet spell; a recent call or a closed deal doesn't", () => {
    const deals = [deal("quiet", { lastCallAt: "2026-10-01T00:00:00Z" }), deal("recent"), deal("won", { status: "won", lastCallAt: "2026-10-01T00:00:00Z" })] as never;
    expect(quietFires([agent], deals, DAY, new Set()).map((f) => f.fireKey)).toEqual([quietFireKey("quiet", "2026-10-01T00:00:00Z")]);
    expect(quietFires([agent], deals, DAY, new Set([`aq|${quietFireKey("quiet", "2026-10-01T00:00:00Z")}`]))).toEqual([]);
    // A call since then ends the spell; quiet again later is a new key.
    expect(quietFireKey("quiet", "2026-11-01T00:00:00Z")).not.toBe(quietFireKey("quiet", "2026-10-01T00:00:00Z"));
  });
  it("other triggers never fire here", () => {
    expect(quietFires([{ ...agent, trigger: { kind: "close_date_near", days: 7 } }] as never, [deal("quiet", { lastCallAt: "2026-10-01T00:00:00Z" })] as never, DAY, new Set())).toEqual([]);
  });
});

describe("runRevenueDaily", () => {
  it("runs gone-quiet agents once per spell, with the fire key", async () => {
    st.deals = { co1: [deal("q", { lastCallAt: "2026-10-01T00:00:00Z" })] };
    st.agents = [{ id: "aq", company_id: "co1", owner_id: "m", name: "x", trigger: { kind: "deal_gone_quiet" }, actions: [] }];
    expect((await runRevenueDaily(admin, NOW)).fired).toBe(1);
    expect(st.ran).toEqual([{ agent: "aq", pid: "q", test: false, fireKey: quietFireKey("q", "2026-10-01T00:00:00Z") }]);
    st.ran = [];
    expect((await runRevenueDaily(admin, NOW)).fired).toBe(0);
  });
  it("reads each company through the pinned reader; a failed company is counted and gets nothing written", async () => {
    st.deals = { co1: [deal("a")], co2: null };
    const r = await runRevenueDaily(admin, NOW);
    expect(st.asked).toEqual([{ companyId: "co1", sentiment: true }, { companyId: "co2", sentiment: true }]);
    expect(r).toMatchObject({ companies: 1, snapshots: 1, failedCompanies: 1 });
    expect(st.upserts.flat()).toEqual([expect.objectContaining({ company_id: "co1", prospect_id: "a" })]);
  });
  it("runs close-date agents once, with the fire key", async () => {
    st.deals = { co1: [deal("a", { closeDate: "2026-11-30" })] };
    st.agents = [{ id: "ag", company_id: "co1", owner_id: "m", name: "x", trigger: { kind: "close_date_near", days: 7 }, actions: [] }];
    expect((await runRevenueDaily(admin, NOW)).fired).toBe(1);
    expect(st.ran).toEqual([{ agent: "ag", pid: "a", test: false, fireKey: closeFireKey("a", "2026-11-30", 7) }]);
    // A second, overlapping run: the claim is taken, so it doesn't act.
    st.ran = [];
    expect((await runRevenueDaily(admin, NOW)).fired).toBe(0);
    expect(st.ran).toEqual([]);
  });
  it("a second run the same day writes only what isn't stored; a racing duplicate is 'already there'", async () => {
    st.deals = { co1: [deal("a"), deal("b"), deal("c")] };
    st.stored = [{ id: 1, prospect_id: "a" }];
    st.dupOnce = true;
    const r = await runRevenueDaily(admin, NOW);
    expect(r).toMatchObject({ failedCompanies: 0, snapshots: 2 });
    expect(st.upserts.flat().map((x) => (x as { prospect_id: string }).prospect_id)).toEqual(["b", "c"]);
  });
  it("a company already recorded for its day is skipped (a later slot continues an earlier run)", async () => {
    st.deals = { co1: [deal("a")] };
    st.doneCount = 3;
    const r = await runRevenueDaily(admin, NOW);
    expect(st.asked).toEqual([]);
    expect(r).toMatchObject({ companies: 0, snapshots: 0, failedCompanies: 0 });
  });
  it("out of time: the companies not started are counted as remaining", async () => {
    st.deals = { co1: [deal("a")], co2: [deal("b")] };
    const r = await runRevenueDaily(admin, NOW, -1);
    expect(r).toMatchObject({ remaining: 2, companies: 0 });
  });
  it("one company throwing is counted; the next still runs", async () => {
    st.companies = [{ id: "co1", timezone: "UTC" }, { id: "co2", timezone: "UTC" }];
    st.deals = { co1: [deal("a")], co2: [deal("b")] };
    const { listProspects } = await import("../../prospects");
    vi.mocked(listProspects).mockImplementationOnce(async () => { throw new Error("network"); });
    const r = await runRevenueDaily(admin, NOW);
    expect(r).toMatchObject({ failedCompanies: 1, companies: 1 });
  });
});

describe("dayIn", () => {
  it("dates by the company's own timezone; invalid or unset is UTC", () => {
    const t = new Date("2026-11-28T05:15:00Z");
    expect(dayIn("America/Los_Angeles", t)).toBe("2026-11-27");
    expect(dayIn("Asia/Tokyo", t)).toBe("2026-11-28");
    expect(dayIn(null, t)).toBe("2026-11-28");
    expect(dayIn("Not/AZone", t)).toBe("2026-11-28");
  });
});
