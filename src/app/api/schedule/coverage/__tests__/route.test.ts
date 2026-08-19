import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Coverage requirements API. Pins: manager-only POST appends COVERAGE_REQ_DEFINED (event-sourced), GET
 * returns the derived requirements (replayed from the log), and the auth edges.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET, POST, DELETE } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const R = "33333333-3333-4333-8333-333333333333";
function req(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof POST>[0];
}

let appended: { type: string; payload: Record<string, unknown> } | null = null;
function fakeSb(events: unknown[] = []) {
  return {
    // table-aware: the GET now reads BOTH schedule_event (for requirements + gaps) and schedule_employee.
    from: (table: string) => ({ select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: table === "schedule_event" ? events : [], error: null }) }), maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    rpc: async (_fn: string, args: { p_type: string; p_payload: Record<string, unknown> }) => { appended = { type: args.p_type, payload: args.p_payload }; return { error: null }; },
  };
}

beforeEach(() => { appended = null; });

describe("schedule coverage API", () => {
  it("a manager POST appends a COVERAGE_REQ_DEFINED with a generated id", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb());
    const res = await POST(req({ appliesTo: "day", minHeadcount: 3 }));
    expect(res.status).toBe(201);
    expect(appended?.type).toBe("COVERAGE_REQ_DEFINED");
    expect(appended?.payload.minHeadcount).toBe(3);
    expect(appended?.payload.requirementId).toBeTruthy();
  });

  it("a non-manager cannot set coverage (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb());
    expect((await POST(req({ appliesTo: "day", minHeadcount: 3 }))).status).toBe(403);
    expect(appended).toBeNull();
  });

  it("GET returns the derived requirements replayed from the event log", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb([
      { id: "e1", company_id: "c1", type: "COVERAGE_REQ_DEFINED", actor_id: null, payload: { requirementId: R, appliesTo: "day", minHeadcount: 2 }, occurred_at: "2026-08-19T00:00:00Z", seq: 1 },
    ]));
    const res = await GET({} as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.requirements).toHaveLength(1);
    expect(j.requirements[0].minHeadcount).toBe(2);
  });

  it("401 unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await GET({} as Parameters<typeof GET>[0])).status).toBe(401);
  });

  const delReq = (id: string) =>
    ({ url: `http://x/api/schedule/coverage?requirementId=${id}`, headers: new Headers() }) as unknown as Parameters<typeof DELETE>[0];

  it("a manager DELETE appends a COVERAGE_REQ_REMOVED tombstone", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb());
    const res = await DELETE(delReq(R));
    expect(res.status).toBe(200);
    expect(appended?.type).toBe("COVERAGE_REQ_REMOVED");
    expect(appended?.payload.requirementId).toBe(R);
  });

  it("a non-manager cannot remove coverage (403, no append); an invalid id is 400", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb());
    expect((await DELETE(delReq(R))).status).toBe(403);
    expect(appended).toBeNull();
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    expect((await DELETE(delReq("not-a-uuid"))).status).toBe(400);
    expect(appended).toBeNull(); // validation before any append
  });
});
