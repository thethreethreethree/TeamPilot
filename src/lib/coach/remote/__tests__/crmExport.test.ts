import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildCrmCall } from "../crmExport";

/** What "Send to CRM" delivers (0330), assembled at send time, company-pinned; missing parts are null. */
const DATA: Record<string, unknown> = {
  coaching_sessions: { id: "s1", agent_id: "r1", started_at: "2026-11-20T10:00:00Z", context: "phone", client_label: "Betty", outcome: "follow_up" },
  profiles: { full_name: "Rob Rep" },
  events: { payload: { summary: "Betty wants the bundle." } },
  remote_call_briefs: { key_points: [{ text: "Wants fiber", seq: 3 }], next_steps: [{ text: "Send quote" }] },
  remote_followup_drafts: [{ channel: "text", subject: null, body: "Hi Betty" }, { channel: "email", subject: "Your quote", body: "Dear Betty" }],
  remote_prospect_calls: { prospect_id: "p1" },
  remote_prospects_current: { name: "Betty Ross", organization: "Ross Bakery", stage_label: "Proposal", status: "open", amount: "900", next_call_date: "2026-12-01" },
};
const eqs: Array<[string, string, unknown]> = [];
const admin = {
  from: (t: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit"]) b[m] = () => b;
    b.eq = (c: string, v: unknown) => (eqs.push([t, c, v]), b);
    b.maybeSingle = async () => ({ data: DATA[t] ?? null, error: null });
    b.then = (r: (v: unknown) => unknown) => r({ data: DATA[t] ?? [], error: null });
    return b;
  },
};

describe("buildCrmCall", () => {
  it("the brief, key points, next steps, latest drafts and the prospect — every read pinned to the company", async () => {
    const c = await buildCrmCall(admin as never, "co1", "s1", "https://elostate.com");
    expect(c).toEqual({
      call: { id: "s1", startedAt: "2026-11-20T10:00:00Z", channel: "phone", client: "Betty", rep: "Rob Rep", outcome: "follow_up", url: "https://elostate.com/dashboard/remote-sales/calls/s1" },
      brief: { summary: "Betty wants the bundle.", keyPoints: ["Wants fiber"], nextSteps: ["Send quote"] },
      followUp: { email: { subject: "Your quote", body: "Dear Betty" }, text: { body: "Hi Betty" } },
      prospect: { name: "Betty Ross", organization: "Ross Bakery", stage: "Proposal", status: "open", amount: 900, nextCallDate: "2026-12-01" },
    });
    for (const t of ["coaching_sessions", "events", "remote_call_briefs", "remote_followup_drafts", "remote_prospect_calls", "remote_prospects_current"]) expect(eqs).toContainEqual([t, "company_id", "co1"]);
  });
});
