import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Event-append route — the RQ6 role-per-event-type gate (audit fix). Pins: a manager-only event type
 * (shifts/assignments/approvals/coverage) requires ctx.isAdmin; an employee-appropriate type
 * (TIMEOFF_REQUESTED etc.) is open to any company member. Closes the raw-API self-approve gap.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn(), getCurrentCompanyId: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const U = "11111111-1111-4111-8111-111111111111";
function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

let appended = false;
function fakeSb() {
  return { rpc: async () => { appended = true; return { data: "new-id", error: null }; } };
}

beforeEach(() => {
  appended = false;
  asMock(createClient).mockResolvedValue(fakeSb());
});

const manager = { userId: "u1", companyId: "c1", role: "admin", isAdmin: true };
const member = { userId: "u2", companyId: "c1", role: "Member", isAdmin: false };
const shiftDefined = { type: "SHIFT_DEFINED", payload: { shiftId: U, date: "2026-08-21", start: "09:00", end: "17:00", requiredHeadcount: 1 } };
const timeoffApproved = { type: "TIMEOFF_APPROVED", payload: { timeOffId: U } };
const timeoffRequested = { type: "TIMEOFF_REQUESTED", payload: { timeOffId: U, employeeId: U, type: "vacation", start: "2026-08-21", end: "2026-08-21" } };

describe("POST /api/schedule/events — RQ6 role-per-event-type", () => {
  it("a MANAGER can append a manager-only event (SHIFT_DEFINED → 201)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    expect((await POST(req(shiftDefined))).status).toBe(201);
    expect(appended).toBe(true);
  });

  it("a NON-manager CANNOT self-approve time off (TIMEOFF_APPROVED → 403, no write)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(member);
    expect((await POST(req(timeoffApproved))).status).toBe(403);
    expect(appended).toBe(false);
  });

  it("a non-manager CAN append an employee-appropriate event (TIMEOFF_REQUESTED → 201)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(member);
    expect((await POST(req(timeoffRequested))).status).toBe(201);
    expect(appended).toBe(true);
  });

  it("401 unauthenticated; 400 on an invalid event", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req(shiftDefined))).status).toBe(401);
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    expect((await POST(req({ type: "NONSENSE", payload: {} }))).status).toBe(400);
  });
});
