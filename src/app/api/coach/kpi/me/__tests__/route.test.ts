import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/kpi/me — the agent's own KPI view. Locks: 401 unauthenticated, and that it computes the
 * Layer-1/2 metrics end-to-end from the caller's sessions (compute is REAL — this is the integration seam).
 * The supabase client is faked with a per-table data map; every query is awaited (no maybeSingle here).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
// F23.8 team narrowing: the tree check and the company's people, controllable per test.
const team = vi.hoisted(() => ({ allowed: true, people: [] as Array<{ id: string; company_id: string; manager_id: string | null; role: string; sales_coach_role: string | null }> }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => team.allowed) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: team.people, error: null }) }) }) }),
}));
/** Every .in(column, values) the route sent, by table — to see which reps a read was narrowed to. */
const inCalls: Array<{ table: string; col: string; vals: unknown[] }> = [];

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET } from "../route";

const setAuth = (v: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/** GET now reads ?scope from the request URL — build one (optionally with a scope). */
const req = (scope?: string, extra = "") =>
  new Request(`http://localhost/api/coach/kpi/me${scope ? `?scope=${scope}${extra}` : ""}`);

/** Fake supabase: from(table) → a thenable chain resolving to that table's data. */
const setTables = (tables: Record<string, { data: unknown; error?: unknown }>) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: (t: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.range = () => chain;
      chain.in = (col: string, vals: unknown[]) => (inCalls.push({ table: t, col, vals }), chain);
      chain.not = () => chain; // profiles member read (company scope) uses .not("sales_coach_role","is",null)
      // companies quota-target read uses maybeSingle; null target → quota metric stays "building".
      chain.maybeSingle = async () => ({
        data: t === "companies" ? { sales_coach_monthly_deal_target: null } : null,
        error: null,
      });
      chain.then = (resolve: (v: unknown) => unknown) => resolve(tables[t] ?? { data: [] });
      return chain;
    },
  });

const sess = (id: string, day: string) => ({
  id,
  outcome: "sold",
  deal_value: 100,
  started_at: `${day}T10:00:00.000Z`,
  ended_at: `${day}T10:30:00.000Z`,
  client_label: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  inCalls.length = 0;
  team.allowed = true;
  team.people = [];
});

describe("GET /api/coach/kpi/me", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setTables({});
    expect((await GET(req())).status).toBe(401);
  });

  it("computes Layer-1/2 metrics from the caller's sessions (5 sold → 100% conversion, $500 revenue)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setTables({
      coaching_sessions: {
        data: [
          sess("s1", "2026-07-01"),
          sess("s2", "2026-07-02"),
          sess("s3", "2026-07-03"),
          sess("s4", "2026-07-04"),
          sess("s5", "2026-07-05"),
        ],
      },
      after_pitch_summaries: { data: [] },
      coaching_cues: { data: [] },
      coaching_cue_outcomes: { data: [] },
      coaching_transcript_segments: { data: [] },
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionCount).toBe(5);
    expect(body.minSessions).toBe(5);
    expect(body.metrics.conversionRate.value).toBe(100);
    expect(body.metrics.revenue.value).toBe(500);
    expect(body.metrics.avgDealSize.value).toBe(100);
    // A metric with no data stays gated ("building").
    expect(body.metrics.cueAcceptanceRate.value).toBeNull();
    // Win/loss with 5 wins and 0 losses is an UNDEFINED ratio → gated, never ∞ (consumer wiring, not just compute).
    expect(body.metrics.winLossRatio.value).toBeNull();
    expect(body.metrics.winLossRatio.gated).toBe(true);
    // Quota with no company target set stays "building" (the mock returns target null).
    expect(body.metrics.quotaAttainment.value).toBeNull();
  });

  it("surfaces a real win/loss ratio through the route (4 sold + 1 no_sale → 4.0)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    const mixed = (id: string, day: string, outcome: string) => ({
      id,
      outcome,
      deal_value: outcome === "sold" ? 100 : null,
      started_at: `${day}T10:00:00.000Z`,
      ended_at: `${day}T10:30:00.000Z`,
      client_label: null,
    });
    setTables({
      coaching_sessions: {
        data: [
          mixed("s1", "2026-07-01", "sold"),
          mixed("s2", "2026-07-02", "sold"),
          mixed("s3", "2026-07-03", "sold"),
          mixed("s4", "2026-07-04", "sold"),
          mixed("s5", "2026-07-05", "no_sale"),
        ],
      },
      after_pitch_summaries: { data: [] },
      coaching_cues: { data: [] },
      coaching_cue_outcomes: { data: [] },
      coaching_transcript_segments: { data: [] },
    });
    const body = await (await GET(req())).json();
    expect(body.metrics.winLossRatio.value).toBe(4); // 4 wins ÷ 1 loss
    expect(body.metrics.conversionRate.value).toBe(80); // 4 of 5 opportunities
  });

  it("company scope: an admin sees the pooled business aggregate (founder 2026-08-29)", async () => {
    // The founder's fix — the per-rep view is sparse, but pooled across the company Layer-1 crosses the gate.
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    setTables({
      profiles: { data: [{ id: "u1" }, { id: "u2" }, { id: "u3" }] }, // the company's sales-coach members
      coaching_sessions: {
        data: [
          sess("s1", "2026-07-01"),
          sess("s2", "2026-07-02"),
          sess("s3", "2026-07-03"),
          sess("s4", "2026-07-04"),
          sess("s5", "2026-07-05"),
        ],
      },
      after_pitch_summaries: { data: [] },
      coaching_cues: { data: [] },
      coaching_cue_outcomes: { data: [] },
      coaching_transcript_segments: { data: [] },
    });
    const body = await (await GET(req("company"))).json();
    expect(body.scope).toBe("company"); // admin + scope=company → the business aggregate
    expect(body.metrics.conversionRate.value).toBe(100); // pooled outcomes cross MIN_SESSIONS and show
  });

  it("company scope requested by a NON-admin FALLS BACK to self (no cross-business leak)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setTables({
      profiles: { data: [{ id: "u1" }, { id: "u2" }] },
      coaching_sessions: { data: [] },
      after_pitch_summaries: { data: [] },
      coaching_cues: { data: [] },
      coaching_cue_outcomes: { data: [] },
      coaching_transcript_segments: { data: [] },
    });
    const body = await (await GET(req("company"))).json();
    expect(body.scope).toBe("self"); // a non-admin can never widen to the company
  });
});

describe("GET /api/coach/kpi/me — period (F23.8; founder: outcome numbers only)", () => {
  const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const tables = () => ({
    coaching_sessions: { data: [1, 2, 3, 4, 5].map((i) => sess(`new${i}`, day(i))).concat([1, 2, 3, 4, 5].map((i) => sess(`old${i}`, day(200 + i)))) },
    after_pitch_summaries: { data: [] },
    coaching_cues: { data: [] },
    coaching_cue_outcomes: { data: [] },
    coaching_transcript_segments: { data: [] },
  });
  it("30 days: revenue counts only the last 30 days' sessions; all time counts every one", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setTables(tables());
    const recent = await (await GET(new Request("http://localhost/api/coach/kpi/me?days=30"))).json();
    expect(recent.periodDays).toBe(30);
    expect(recent.periodSessionCount).toBe(5);
    expect(recent.metrics.revenue.value).toBe(500);
    expect(recent.sessionCount).toBe(10); // the page's session count stays all-time
    setTables(tables());
    const all = await (await GET(req())).json();
    expect(all.periodDays).toBeNull();
    expect(all.metrics.revenue.value).toBe(1000);
  });
  it("an unknown period is all time", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setTables(tables());
    expect((await (await GET(new Request("http://localhost/api/coach/kpi/me?days=7"))).json()).periodDays).toBeNull();
  });
});

describe("GET /api/coach/kpi/me — one manager's team in the company view (F23.8)", () => {
  const MGR = "11111111-1111-4111-8111-111111111111";
  const tables = () => ({
    profiles: { data: [{ id: "u1" }, { id: MGR }, { id: "r1" }, { id: "r2" }] },
    coaching_sessions: { data: [] },
    after_pitch_summaries: { data: [] },
    coaching_cues: { data: [] },
    coaching_cue_outcomes: { data: [] },
    coaching_transcript_segments: { data: [] },
  });
  const person = (id: string, manager_id: string | null) => ({ id, company_id: "co1", manager_id, role: "Member", sales_coach_role: "staff" });
  const sessionReps = () => inCalls.find((c) => c.table === "coaching_sessions" && c.col === "agent_id")?.vals;

  it("narrows the pooled sessions to the manager and everyone below them, and says which team", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    team.people = [person("u1", null), person(MGR, "u1"), person("r1", MGR), person("r2", "u1")];
    setTables(tables());
    const body = await (await GET(req("company", `&team=${MGR}`))).json();
    expect(body).toMatchObject({ scope: "company", team: MGR, canPool: true });
    expect(new Set(sessionReps())).toEqual(new Set([MGR, "r1"]));
  });

  it("a team the caller's tree doesn't allow is refused (404), never shown as the company", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    team.allowed = false;
    team.people = [person(MGR, null)];
    setTables(tables());
    expect((await GET(req("company", `&team=${MGR}`))).status).toBe(404);
  });

  it("a non-admin gets their own numbers whatever the team, and is told they can't pool", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setTables(tables());
    const body = await (await GET(req("company", `&team=${MGR}`))).json();
    expect(body).toMatchObject({ scope: "self", team: null, canPool: false });
    expect(sessionReps()).toEqual(["u1"]);
  });
});

