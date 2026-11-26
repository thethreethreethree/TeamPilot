import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/engage/enrolments (0377; plan E1). Pinned: an opt-out anywhere blocks enrolment; a call step needs
 * an outcome, and "Meeting booked" finishes the enrolment; an action that doesn't apply where the replay stands is 409.
 */
const st = vi.hoisted(() => ({
  deal: { id: "d1", rep_id: "rep-1", company_id: "co1" } as unknown,
  theirEnrolments: [] as unknown[],
  optOuts: 0,
  enrolment: { id: "e1", company_id: "co1", flow_id: "f1", created_at: "2026-11-24T10:00:00Z" } as unknown,
  steps: [{ kind: "call", delay: { amount: 0, unit: "business_days" }, title: "Call" }, { kind: "email", delay: { amount: 1, unit: "business_days" }, title: "Mail" }] as unknown,
  acts: [] as unknown[],
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep-1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/coach/remote/engage/today", () => ({ listEngage: vi.fn(async () => []), EngageReadError: class extends Error {} }));
const q = (table: string) => {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: table === "remote_prospects" ? st.deal : table === "engage_enrolments" ? st.enrolment : table === "engage_flows" ? { steps: st.steps } : null, error: null });
  b.then = (r: (v: unknown) => unknown) => r(table === "engage_enrolments" ? { data: st.theirEnrolments, error: null } : table === "engage_activities" ? { data: st.acts, error: null, count: st.optOuts } : { data: [], error: null });
  b.insert = (row: Record<string, unknown>) => {
    st.inserts.push({ table, row });
    const res = { data: { id: "new" }, error: null };
    return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => res }) });
  };
  return b;
};
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({ from: q }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: q }) }));
import { NextRequest } from "next/server";
import { POST } from "../route";
const U = "11111111-1111-4111-8111-111111111111";
const post = (b: unknown) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(b) }));
beforeEach(() => {
  st.theirEnrolments = [];
  st.optOuts = 0;
  st.acts = [];
  st.inserts = [];
});

describe("engage enrolments", () => {
  it("enrols the deal's contact with the deal's rep", async () => {
    expect((await post({ action: "enrol", flowId: U, prospectId: U, contactId: U })).status).toBe(200);
    expect(st.inserts[0]).toMatchObject({ table: "engage_enrolments", row: { rep_id: "rep-1", created_by: "rep-1", company_id: "co1" } });
  });
  it("an opt-out on any of their enrolments blocks it (409), nothing written", async () => {
    st.theirEnrolments = [{ id: "old" }];
    st.optOuts = 1;
    expect((await post({ action: "enrol", flowId: U, prospectId: U, contactId: U })).status).toBe(409);
    expect(st.inserts).toEqual([]);
  });
  it("a call step needs an outcome; 'Meeting booked' is stored as the enrolment's end", async () => {
    expect((await post({ action: "step", enrolmentId: U, kind: "complete_step" })).status).toBe(400);
    expect((await post({ action: "step", enrolmentId: U, kind: "complete_step", outcome: "meeting_booked" })).status).toBe(200);
    expect(st.inserts[0]).toMatchObject({ table: "engage_activities", row: { action: "meeting_booked", outcome: "meeting_booked", step_index: 0 } });
  });
  it("an action that doesn't apply where the replay stands is 409", async () => {
    expect((await post({ action: "step", enrolmentId: U, kind: "resume" })).status).toBe(409);
    st.acts = [{ step_index: 0, action: "replied", created_at: "2026-11-25T10:00:00Z" }];
    expect((await post({ action: "step", enrolmentId: U, kind: "pause" })).status).toBe(409);
  });
});
