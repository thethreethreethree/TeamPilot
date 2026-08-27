import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Finding C + D (schedule audit 2026-08-27). The events WRITE route now consumes the authority's verdict on
 * assignment events instead of merely letting them through: an ABSOLUTE conflict (double-booking / approved
 * time-off / over-hours / ineligible) is rejected 422, a phantom shift/employee id is rejected 409, and a clean
 * assignment appends 201. This gates the CONSUMER (the write path), not the mapping — the authority math itself is
 * covered by authority.test.ts. Without enforcement a manager could POST an impossible assignment (the A40
 * verdict-computed-but-not-consumed class one level up).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const S1 = "aaaaaaaa-1111-4111-8111-111111111111";
const S2 = "bbbbbbbb-2222-4222-8222-222222222222";
const E1 = "11111111-1111-4111-8111-111111111111";
const E3 = "33333333-3333-4333-8333-333333333333";
const PHANTOM = "99999999-9999-4999-8999-999999999999";
function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

// S1 Mon 09:00–17:00 with E1 already on it; S2 Mon 12:00–20:00 OVERLAPS S1 (so E1→S2 double-books).
const EVENTS = [
  { id: "e1", company_id: "c1", type: "SHIFT_DEFINED", actor_id: null, payload: { shiftId: S1, date: "2026-08-24", start: "09:00", end: "17:00", requiredHeadcount: 1 }, occurred_at: "2026-08-19T00:00:00Z", seq: 1 },
  { id: "e2", company_id: "c1", type: "EMPLOYEE_ASSIGNED", actor_id: null, payload: { shiftId: S1, employeeId: E1 }, occurred_at: "2026-08-19T00:00:00Z", seq: 2 },
  { id: "e3", company_id: "c1", type: "SHIFT_DEFINED", actor_id: null, payload: { shiftId: S2, date: "2026-08-24", start: "12:00", end: "20:00", requiredHeadcount: 1 }, occurred_at: "2026-08-19T00:00:00Z", seq: 3 },
];
const ROSTER = [E1, E3].map((id) => ({ id, company_id: "c1", name: id, role: null, employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" }));

let appended = false;
function fakeSb() {
  return {
    from: (table: string) => ({
      select: () => ({ eq: () => ({
        order: () => ({ range: async () => ({ data: table === "schedule_event" ? EVENTS : ROSTER, error: null }) }),
        maybeSingle: async () => ({ data: null, error: null }), // getScheduleSettings → defaults
      }) }),
    }),
    rpc: async () => { appended = true; return { data: "new-id", error: null }; },
  };
}

const manager = { userId: "u1", companyId: "c1", role: "admin", isAdmin: true };
beforeEach(() => {
  appended = false;
  asMock(createClient).mockResolvedValue(fakeSb());
  asMock(getCurrentAuthContext).mockResolvedValue(manager);
});

describe("POST /api/schedule/events — authority enforcement on assignment writes", () => {
  it("REJECTS an absolute conflict (double-booking) with 422 and does NOT append", async () => {
    const res = await POST(req({ type: "EMPLOYEE_ASSIGNED", payload: { shiftId: S2, employeeId: E1 } }));
    expect(res.status).toBe(422);
    expect(appended).toBe(false);
    const j = await res.json();
    expect(j.violations.some((v: { kind: string }) => v.kind === "double_booked")).toBe(true);
  });

  it("APPENDS a clean assignment (E3 is free) with 201", async () => {
    const res = await POST(req({ type: "EMPLOYEE_ASSIGNED", payload: { shiftId: S2, employeeId: E3 } }));
    expect(res.status).toBe(201);
    expect(appended).toBe(true);
  });

  it("REJECTS a phantom shift id with 409 (no write) — a stale/foreign id can't inflate coverage", async () => {
    const res = await POST(req({ type: "EMPLOYEE_ASSIGNED", payload: { shiftId: PHANTOM, employeeId: E3 } }));
    expect(res.status).toBe(409);
    expect(appended).toBe(false);
  });

  it("REJECTS a phantom employee id with 409 (no write)", async () => {
    const res = await POST(req({ type: "EMPLOYEE_ASSIGNED", payload: { shiftId: S2, employeeId: PHANTOM } }));
    expect(res.status).toBe(409);
    expect(appended).toBe(false);
  });
});
