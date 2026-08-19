import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Record a time-off request + decision. Pins: manager-only; a request always records TIMEOFF_REQUESTED,
 * and an approve/deny appends the matching decision event (append-only, a correction is a new event).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST, GET } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const U = "11111111-1111-4111-8111-111111111111";
function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

let rpcTypes: string[] = [];
function fakeSb() {
  return { rpc: async (_fn: string, args: { p_type: string }) => { rpcTypes.push(args.p_type); return { error: null }; } };
}

beforeEach(() => {
  rpcTypes = [];
  asMock(createClient).mockResolvedValue(fakeSb());
});

describe("POST /api/schedule/timeoff", () => {
  const base = { employeeId: U, type: "vacation", start: "2026-08-21", end: "2026-08-21" };

  it("records a pending request (TIMEOFF_REQUESTED only)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    const res = await POST(req({ ...base, decision: "request" }));
    expect(res.status).toBe(201);
    expect((await res.json()).status).toBe("requested");
    expect(rpcTypes).toEqual(["TIMEOFF_REQUESTED"]);
  });

  it("approve records REQUESTED then APPROVED", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    const res = await POST(req({ ...base, decision: "approve" }));
    expect((await res.json()).status).toBe("approved");
    expect(rpcTypes).toEqual(["TIMEOFF_REQUESTED", "TIMEOFF_APPROVED"]);
  });

  it("deny records REQUESTED then DENIED", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    await POST(req({ ...base, decision: "deny" }));
    expect(rpcTypes).toEqual(["TIMEOFF_REQUESTED", "TIMEOFF_DENIED"]);
  });

  it("non-manager 403; unauthenticated 401", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    expect((await POST(req(base))).status).toBe(403);
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req(base))).status).toBe(401);
  });
});

describe("GET /api/schedule/timeoff (the list)", () => {
  const evRow = (seq: number, type: string, payload: Record<string, unknown>) =>
    ({ id: `e${seq}`, company_id: "c1", type, actor_id: null, payload, occurred_at: "2026-08-19T00:00:00Z", seq });
  function readSb(events: unknown[], employees: unknown[]) {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            order: () => ({ range: async () => ({ data: table === "schedule_event" ? events : employees, error: null }) }),
            maybeSingle: async () => ({ data: null, error: null }), // companies settings read → defaults
          }),
        }),
      }),
    };
  }

  it("returns the derived time off with the staff member's name", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(readSb(
      [
        // far-future dates so the GET's "current/upcoming" filter (end >= today) keeps them on any run date.
        evRow(1, "TIMEOFF_REQUESTED", { timeOffId: U, employeeId: "emp1", type: "vacation", start: "2099-08-21", end: "2099-08-22" }),
        evRow(2, "TIMEOFF_APPROVED", { timeOffId: U }),
      ],
      [{ id: "emp1", company_id: "c1", name: "Alex", role: null, employment_type: null, skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active" }],
    ));
    const res = await GET({} as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.timeOff).toHaveLength(1);
    expect(j.timeOff[0]).toMatchObject({ employeeName: "Alex", type: "vacation", status: "approved" });
  });

  it("401 unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await GET({} as Parameters<typeof GET>[0])).status).toBe(401);
  });
});
