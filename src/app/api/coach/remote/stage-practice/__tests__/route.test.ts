import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
type Res = { data: unknown; error: unknown };
const st = vi.hoisted(() => ({
  caller: {} as Record<string, Res>,
  insert: { data: { id: "new-a" }, error: null } as Res,
  existing: { data: { id: "old-a" }, error: null } as Res,
  inserted: [] as unknown[],
}));
const chain = (res: () => Res, onInsert?: (row: unknown) => void) => {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "is", "order", "limit"]) b[m] = () => b;
  b.maybeSingle = async () => res();
  b.insert = (row: unknown) => (onInsert?.(row), { select: () => ({ maybeSingle: async () => st.insert }) });
  b.then = (r: (v: unknown) => unknown) => r(res());
  return b;
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (t: string) => chain(() => st.caller[t] ?? { data: [], error: null }) }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => chain(() => st.existing, (row) => st.inserted.push(row)) }) }));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { GET, POST } from "../route";

const ME = "u-rep";
const prospect = (over: Record<string, unknown> = {}) => ({ data: { id: "p1", rep_id: ME, status: "open", stage_label: "Demo", next_call_date: "2099-01-05", ...over }, error: null });
const get = () => ({ nextUrl: new URL("http://x/api?prospectId=p1") }) as never;
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never;

beforeEach(() => {
  vi.mocked(resolveApiAuth).mockResolvedValue({ userId: ME, companyId: "co1" } as never);
  st.caller = {
    remote_prospects_current: prospect(),
    training_scenario_stages_current: { data: [{ scenario_id: "s1" }], error: null },
    training_scenarios: { data: [{ id: "s1", title: "Demo opener", focus: "Agenda", difficulty: "easy", length_min: 5 }], error: null },
    training_assignments: { data: [], error: null },
  };
  st.insert = { data: { id: "new-a" }, error: null };
  st.existing = { data: { id: "old-a" }, error: null };
  st.inserted = [];
});

describe("GET stage-practice", () => {
  it("lists the scenarios tagged with the prospect's stage; the own rep can start them", async () => {
    const j = await (await GET(get())).json();
    expect(j).toMatchObject({ stage: "Demo", canStart: true, scenarios: [{ id: "s1", title: "Demo opener", assignmentId: null }] });
  });
  it("a manager viewing a report's prospect sees the list but cannot start", async () => {
    st.caller.remote_prospects_current = prospect({ rep_id: "someone-else" });
    expect(await (await GET(get())).json()).toMatchObject({ canStart: false });
  });
  it("a failed read is a 500, not an empty list", async () => {
    st.caller.training_scenario_stages_current = { data: null, error: { message: "x" } };
    expect((await GET(get())).status).toBe(500);
  });
  it("rep needs (0326): the scenario training the rep's most-missed item comes first, with why", async () => {
    st.caller.training_scenario_stages_current = { data: [{ scenario_id: "s1" }, { scenario_id: "s2" }], error: null };
    st.caller.training_scenarios = {
      data: [
        { id: "s1", title: "Demo opener", focus: "Agenda", difficulty: "easy", length_min: 5 },
        { id: "s2", title: "Close it", focus: "Ask for the order", difficulty: "hard", length_min: 8 },
      ],
      error: null,
    };
    st.caller.training_scenario_elements_current = { data: [{ scenario_id: "s2", element_id: "close.ask" }], error: null };
    st.caller.pitch_scores_by_channel = { data: [{ id: "p1" }, { id: "p2" }, { id: "p3" }], error: null };
    st.caller.pitch_score_elements = { data: [{ element_id: "close.ask", grade: "missed" }, { element_id: "close.ask", grade: "missed" }, { element_id: "close.ask", grade: "hit" }], error: null };
    const j = await (await GET(get())).json();
    expect(j.scenarios.map((s: { id: string }) => s.id)).toEqual(["s2", "s1"]);
    expect(j.scenarios[0].need).toMatchObject({ misses: 2, graded: 3 });
    expect(j.scenarios[1].need).toBeNull();
  });
  it("needs that can't be read leave the list in its order, never hidden", async () => {
    st.caller.training_scenario_elements_current = { data: null, error: { message: "x" } };
    const j = await (await GET(get())).json();
    expect(j.scenarios).toHaveLength(1);
    expect(j.scenarios[0].need).toBeNull();
  });
  it("a closed prospect gets no stage practice", async () => {
    st.caller.remote_prospects_current = prospect({ status: "won" });
    expect(await (await GET(get())).json()).toMatchObject({ scenarios: [] });
  });
});

describe("POST stage-practice", () => {
  it("starts the rep's own practice, self-assigned, due on the next call", async () => {
    const r = await POST(post({ prospectId: "p1", scenarioId: "s1" }));
    expect(await r.json()).toEqual({ assignmentId: "new-a", started: true });
    expect(st.inserted[0]).toMatchObject({ company_id: "co1", scenario_id: "s1", rep_id: ME, assigned_by: ME, due_at: "2099-01-05T23:59:00.000Z" });
  });
  it("refuses someone else's prospect", async () => {
    st.caller.remote_prospects_current = prospect({ rep_id: "someone-else" });
    expect((await POST(post({ prospectId: "p1", scenarioId: "s1" }))).status).toBe(403);
    expect(st.inserted).toEqual([]);
  });
  it("refuses a scenario not tagged with the prospect's stage", async () => {
    expect((await POST(post({ prospectId: "p1", scenarioId: "s9" }))).status).toBe(409);
    expect(st.inserted).toEqual([]);
  });
  it("starting it twice returns the same practice", async () => {
    st.insert = { data: null, error: { code: "23505", message: "dup" } };
    expect(await (await POST(post({ prospectId: "p1", scenarioId: "s1" }))).json()).toEqual({ assignmentId: "old-a", started: false });
  });
});
