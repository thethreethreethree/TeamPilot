import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));
type Res = { data: unknown; error: unknown };
const st = vi.hoisted(() => ({ reads: {} as Record<string, Res>, insertErr: null as unknown, inserted: [] as unknown[] }));
const client = vi.hoisted(() => () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "not", "limit", "order"]) b[m] = () => b;
      b.maybeSingle = async () => st.reads[t];
      b.then = (r: (v: unknown) => unknown) => r(st.reads[t]);
      b.insert = async (row: unknown) => (st.inserted.push(row), { error: st.insertErr });
      return b;
    },
  }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: client }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET, PUT } from "../route";

const put = (body: unknown) => new Request("http://x/api", { method: "PUT", body: JSON.stringify(body) }) as never;
const get = () => new Request("http://x/api") as never;

beforeEach(() => {
  vi.mocked(requireSalesCoachManager).mockResolvedValue({ userId: "m1", companyId: "co1" });
  st.reads = {
    training_scenarios: { data: { id: "s1", retired_at: null }, error: null },
    training_scenario_stages_current: { data: [{ scenario_id: "s1", stage_label: "Demo" }], error: null },
    remote_prospects_current: { data: [{ stage_label: "Demo" }, { stage_label: "Demo" }, { stage_label: "demo" }, { stage_label: "Close" }], error: null },
    deal_stage_list_current: { data: null, error: null },
  };
  st.insertErr = null;
  st.inserted = [];
});

describe("scenario stages route", () => {
  it("managers only", async () => {
    vi.mocked(requireSalesCoachManager).mockResolvedValue(null);
    expect((await GET(get())).status).toBe(403);
    expect((await PUT(put({ scenarioId: "s1", stage: "Demo", on: true }))).status).toBe(403);
  });
  it("GET returns the tags and the stage names in use", async () => {
    expect(await (await GET(get())).json()).toEqual({ available: true, tags: [{ scenarioId: "s1", label: "Demo" }], stages: ["Close", "Demo"] });
  });
  it("GET offers the company's own stage list first (0371), then other names in use", async () => {
    st.reads.deal_stage_list_current = { data: { stages: [{ name: "Discovery", kind: "open" }, { name: "Demo", kind: "open" }] }, error: null };
    expect((await (await GET(get())).json()).stages).toEqual(["Discovery", "Demo", "Close"]);
  });
  it("GET says so when 0310 is not applied, and 500s on any other failure", async () => {
    st.reads.training_scenario_stages_current = { data: null, error: { code: "42P01", message: "missing" } };
    expect(await (await GET(get())).json()).toMatchObject({ available: false });
    st.reads.training_scenario_stages_current = { data: null, error: { code: "XX000", message: "x" } };
    expect((await GET(get())).status).toBe(500);
  });
  it("PUT appends an event with the normalised key", async () => {
    expect((await PUT(put({ scenarioId: "s1", stage: "  Demo   Booked ", on: true }))).status).toBe(200);
    expect(st.inserted[0]).toEqual({ company_id: "co1", scenario_id: "s1", stage_label: "Demo Booked", stage_key: "demo booked", is_on: true, set_by: "m1" });
  });
  it("PUT refuses a bad body, an unknown scenario, and tagging a retired one", async () => {
    expect((await PUT(put({ scenarioId: "s1", stage: "", on: true }))).status).toBe(400);
    expect((await PUT(put({ scenarioId: "s1", stage: "Demo" }))).status).toBe(400);
    st.reads.training_scenarios = { data: null, error: null };
    expect((await PUT(put({ scenarioId: "s1", stage: "Demo", on: true }))).status).toBe(404);
    st.reads.training_scenarios = { data: { id: "s1", retired_at: "2026-11-01" }, error: null };
    expect((await PUT(put({ scenarioId: "s1", stage: "Demo", on: true }))).status).toBe(409);
    expect((await PUT(put({ scenarioId: "s1", stage: "Demo", on: false }))).status).toBe(200); // untagging a retired one is fine
  });
});
