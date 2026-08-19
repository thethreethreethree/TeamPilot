import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Time-off evaluate. Pins: manager-only, and the deterministic pipeline runs — a time-off that drops a
 * shift below its coverage minimum yields an overridable coverage verdict + resolution candidates. The LLM
 * proposal is mocked (advisory, fail-soft).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/schedule/ai", () => ({ generateProposal: vi.fn(async () => "Recommend Vera.") }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const U = "11111111-1111-4111-8111-111111111111"; // the requester
const V = "22222222-2222-4222-8222-222222222222"; // a free candidate
const R = "33333333-3333-4333-8333-333333333333"; // requirement id

function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

function evRow(seq: number, type: string, payload: Record<string, unknown>) {
  return { id: `e${seq}`, company_id: "c1", type, actor_id: null, payload, occurred_at: "2026-08-19T00:00:00Z", seq };
}
const EVENTS = [
  evRow(1, "SHIFT_DEFINED", { shiftId: "S1", date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 1 }),
  evRow(2, "EMPLOYEE_ASSIGNED", { shiftId: "S1", employeeId: U }),
  evRow(3, "COVERAGE_REQ_DEFINED", { requirementId: R, appliesTo: "day", minHeadcount: 1 }),
];
const ROSTER = [
  { id: U, company_id: "c1", name: "Uma", role: null, employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" },
  { id: V, company_id: "c1", name: "Vera", role: null, employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" },
];

function fakeSb() {
  return {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: table === "schedule_event" ? EVENTS : ROSTER, error: null }) }), maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  asMock(createClient).mockResolvedValue(fakeSb());
});

describe("POST /api/schedule/timeoff/evaluate", () => {
  it("a time-off that drops coverage → overridable verdict + a resolution candidate", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    const res = await POST(req({ employeeId: U, start: "2026-08-21", end: "2026-08-21" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.verdict.approvable).toBe(true); // block-by-default but manager-overridable
    expect(j.verdict.autoApprovable).toBe(false); // it drops coverage
    expect(j.resolutionsByShift[0].shiftId).toBe("S1");
    // Vera is free + eligible → a candidate to fill the gap
    expect(j.resolutionsByShift[0].candidates.map((c: { name: string }) => c.name)).toContain("Vera");
    expect(j.proposal).toBe("Recommend Vera."); // advisory proposal included
  });

  it("non-manager 403; unauthenticated 401", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    expect((await POST(req({ employeeId: U, start: "2026-08-21", end: "2026-08-21" }))).status).toBe(403);
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ employeeId: U, start: "2026-08-21", end: "2026-08-21" }))).status).toBe(401);
  });
});
