import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Evaluate a proposed shift's assignments. Pins: manager-only, and it returns per-employee conflicts computed
 * from the derived state (double-booking here — E1 already works an overlapping shift that day).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const E1 = "11111111-1111-4111-8111-111111111111";
const E3 = "33333333-3333-4333-8333-333333333333";
function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

const EVENTS = [
  { id: "e1", company_id: "c1", type: "SHIFT_DEFINED", actor_id: null, payload: { shiftId: "S1", date: "2026-08-20", start: "09:00", end: "17:00", requiredHeadcount: 1 }, occurred_at: "2026-08-19T00:00:00Z", seq: 1 },
  { id: "e2", company_id: "c1", type: "EMPLOYEE_ASSIGNED", actor_id: null, payload: { shiftId: "S1", employeeId: E1 }, occurred_at: "2026-08-19T00:00:00Z", seq: 2 },
];
const ROSTER = [E1, E3].map((id) => ({ id, company_id: "c1", name: id, role: null, employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" }));

function fakeSb() {
  return {
    from: (table: string) => ({
      select: () => ({ eq: () => ({
        order: () => ({ range: async () => ({ data: table === "schedule_event" ? EVENTS : ROSTER, error: null }) }),
        maybeSingle: async () => ({ data: null, error: null }),
      }) }),
    }),
  };
}

const BODY = { date: "2026-08-20", start: "10:00", end: "14:00", requiredHeadcount: 1, employeeIds: [E1, E3] };

beforeEach(() => { asMock(createClient).mockResolvedValue(fakeSb()); });

describe("POST /api/schedule/assign/evaluate", () => {
  it("a manager gets per-employee conflicts (E1 double-booked, E3 clean)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    const res = await POST(req(BODY));
    expect(res.status).toBe(200);
    const { impacts } = await res.json();
    const e1 = impacts.find((i: { employeeId: string }) => i.employeeId === E1);
    const e3 = impacts.find((i: { employeeId: string }) => i.employeeId === E3);
    expect(e1.violations.some((v: { kind: string }) => v.kind === "double_booked")).toBe(true);
    expect(e3.violations).toEqual([]);
  });

  it("non-manager 403; unauthenticated 401", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    expect((await POST(req(BODY))).status).toBe(403);
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req(BODY))).status).toBe(401);
  });
});
