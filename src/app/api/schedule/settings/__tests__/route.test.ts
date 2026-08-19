import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Schedule settings API. Pins: GET returns settings for any authed user; PATCH is manager-only, validates a
 * real IANA zone + a 0-6 workweek-start, and pins the update to the caller's own company_id (INV15).
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET, PATCH } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
function req(body: unknown): Parameters<typeof PATCH>[0] {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof PATCH>[0];
}

let updateArgs: Record<string, unknown> | null = null;
let eqArgs: [string, unknown] | null = null;
function fakeSb(row: unknown = { timezone: "UTC", workweek_start: 1 }) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      update: (vals: Record<string, unknown>) => { updateArgs = vals; return { eq: (col: string, val: unknown) => { eqArgs = [col, val]; return Promise.resolve({ error: null }); } }; },
    }),
  };
}

beforeEach(() => { updateArgs = null; eqArgs = null; });

describe("GET /api/schedule/settings", () => {
  it("returns the company settings for an authed user", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb({ timezone: "America/New_York", workweek_start: 0 }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timezone: "America/New_York", workweekStart: 0 });
  });

  it("401 unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});

describe("PATCH /api/schedule/settings", () => {
  it("a manager saves valid settings, pinned to their own company", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb());
    const res = await PATCH(req({ timezone: "America/Chicago", workweekStart: 0 }));
    expect(res.status).toBe(200);
    expect(updateArgs).toEqual({ timezone: "America/Chicago", workweek_start: 0 });
    expect(eqArgs).toEqual(["id", "c1"]); // INV15 — pinned to the session company
  });

  it("rejects an invalid IANA timezone (400)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb());
    expect((await PATCH(req({ timezone: "Not/AZone", workweekStart: 1 }))).status).toBe(400);
  });

  it("rejects an out-of-range workweekStart (400)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb());
    expect((await PATCH(req({ timezone: "UTC", workweekStart: 9 }))).status).toBe(400);
  });

  it("a non-manager is blocked (403); unauthenticated (401)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    asMock(createClient).mockResolvedValue(fakeSb());
    expect((await PATCH(req({ timezone: "UTC", workweekStart: 1 }))).status).toBe(403);
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await PATCH(req({ timezone: "UTC", workweekStart: 1 }))).status).toBe(401);
  });
});
