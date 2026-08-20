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
    expect(await res.json()).toEqual({ timezone: "America/New_York", workweekStart: 0, scheduleName: null });
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
    expect(updateArgs).toEqual({ timezone: "America/Chicago", workweek_start: 0, schedule_name: null });
    expect(eqArgs).toEqual(["id", "c1"]); // INV15 — pinned to the session company
  });

  it("persists a custom schedule name, trimmed (blank stays null)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(createClient).mockResolvedValue(fakeSb());
    const res = await PATCH(req({ timezone: "UTC", workweekStart: 1, scheduleName: "  Front of House  " }));
    expect(res.status).toBe(200);
    expect(updateArgs).toEqual({ timezone: "UTC", workweek_start: 1, schedule_name: "Front of House" });
    expect(await res.json()).toEqual({ timezone: "UTC", workweekStart: 1, scheduleName: "Front of House" });
  });

  it("degrades when schedule_name is not migrated (pre-0234): saves timezone/workweek, drops the name, returns a notice", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    const calls: Record<string, unknown>[] = [];
    const sb = {
      from: () => ({
        update: (vals: Record<string, unknown>) => { calls.push(vals); return { eq: () => Promise.resolve(
          "schedule_name" in vals
            ? { error: { code: "PGRST204", message: "Could not find the 'schedule_name' column of 'companies' in the schema cache" } }
            : { error: null },
        ) }; },
      }),
    };
    asMock(createClient).mockResolvedValue(sb);
    const res = await PATCH(req({ timezone: "UTC", workweekStart: 1, scheduleName: "Front of House" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scheduleName).toBeNull(); // the name could not be saved — reported honestly, not silently
    expect(body.notice).toMatch(/0234/);
    expect("schedule_name" in calls[0]!).toBe(true);  // first attempt included the new column
    expect("schedule_name" in calls[1]!).toBe(false); // retry saved only the pre-0234 columns
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
