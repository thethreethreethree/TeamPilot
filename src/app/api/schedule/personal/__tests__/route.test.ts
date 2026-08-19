import { describe, it, expect, vi } from "vitest";

/**
 * Personal schedule API (Phase 6, manager-entered). Pins: manager-only, company-scoped lookup, a
 * stranger id is 404 (never another company's staff), and the derived schedule is the employee's own
 * upcoming shifts. Read-only — no events appended.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const EMP = "44444444-4444-4444-8444-444444444444";
const SHIFT = "55555555-5555-4555-8555-555555555555";
const getReq = (id: string) =>
  ({ url: `http://x/api/schedule/personal?employeeId=${id}`, headers: new Headers() }) as unknown as Parameters<typeof GET>[0];

function fakeSb(opts: { emp?: unknown; events?: unknown[] } = {}) {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        range: async () => ({ data: table === "schedule_event" ? (opts.events ?? []) : [], error: null }),
        maybeSingle: async () => ({
          data: table === "schedule_employee" ? (opts.emp ?? null) : null, // companies → null → default settings
          error: null,
        }),
      };
      return chain;
    },
  };
}

const empRow = { id: EMP, company_id: "c1", name: "Alex", role: "nurse", employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" };

describe("schedule personal API", () => {
  it("a manager gets an employee's own upcoming shifts", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb({
      emp: empRow,
      events: [
        { id: "e1", company_id: "c1", type: "SHIFT_DEFINED", actor_id: null, payload: { shiftId: SHIFT, date: "2099-01-01", start: "09:00", end: "17:00", requiredHeadcount: 1 }, occurred_at: "2026-08-20T00:00:00Z", seq: 1 },
        { id: "e2", company_id: "c1", type: "EMPLOYEE_ASSIGNED", actor_id: null, payload: { shiftId: SHIFT, employeeId: EMP }, occurred_at: "2026-08-20T00:00:00Z", seq: 2 },
      ],
    }));
    const res = await GET(getReq(EMP));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.employee.name).toBe("Alex");
    expect(j.schedule.upcoming).toHaveLength(1);
    expect(j.schedule.upcoming[0].id).toBe(SHIFT);
    expect(j.schedule.totalHours).toBe(8);
  });

  it("a non-manager is refused (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb({ emp: empRow }));
    expect((await GET(getReq(EMP))).status).toBe(403);
  });

  it("a stranger id is 404, not another company's data", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb({ emp: null })); // scoped lookup finds nothing
    expect((await GET(getReq(EMP))).status).toBe(404);
  });

  it("an invalid employee id is 400 before any lookup", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb());
    expect((await GET(getReq("not-a-uuid"))).status).toBe(400);
  });

  it("401 unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    asMock(createClient).mockResolvedValue(fakeSb());
    expect((await GET(getReq(EMP))).status).toBe(401);
  });
});
