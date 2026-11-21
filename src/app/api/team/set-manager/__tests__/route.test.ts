import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/team/set-manager (RSS Phase 0, Gong F2.4). Locks: 401 / 403 / 400; the company pin on the read
 * AND the write (the fake applies `.eq` filters, so a dropped tenant filter changes the outcome — the
 * INVARIANT 29 note about builders that ignore `.eq`); refusals for self, loops, another company's
 * manager and a removed manager; 503 naming migration 0272 before it is applied; and a clean 200.
 */
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

type Row = { id: string; company_id: string; manager_id: string | null; role: string | null; sales_coach_role: string | null; status: string };

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  readError: null as { code: string; message: string } | null,
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Array<[string, unknown]> }>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: async (k: string, v: unknown) =>
          state.readError ? { data: null, error: state.readError } : { data: state.rows.filter((r) => r[k] === v), error: null },
      }),
      update: (patch: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = [];
        const chain = {
          eq: (k: string, v: unknown) => {
            filters.push([k, v]);
            if (filters.length === 2) {
              state.updates.push({ patch, filters });
              return Promise.resolve({ error: null });
            }
            return chain;
          },
        };
        return chain;
      },
    }),
  }),
}));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const CEO = id(1), MGR = id(2), REP = id(3), REMOVED = id(4), OTHER_CO = id(9);
const person = (pid: string, managerId: string | null, extra: Partial<Row> = {}): Row => ({
  id: pid, company_id: "c1", manager_id: managerId, role: "Member", sales_coach_role: "staff", status: "active", ...extra,
});
const admin = { userId: CEO, companyId: "c1", role: "CEO", isAdmin: true };
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  state.readError = null;
  state.updates = [];
  state.rows = [
    person(CEO, null, { role: "CEO" }),
    person(MGR, CEO, { sales_coach_role: "admin" }),
    person(REP, MGR),
    person(REMOVED, null, { status: "removed" }),
    person(OTHER_CO, null, { company_id: "c2", role: "CEO" }),
  ];
  asMock(getCurrentAuthContext).mockResolvedValue(admin);
});

describe("POST /api/team/set-manager", () => {
  it("401 unauthenticated, 403 non-admin, 400 bad body — and nothing written", async () => {
    asMock(getCurrentAuthContext).mockResolvedValueOnce(null);
    expect((await POST(req({ memberId: REP, managerId: MGR }))).status).toBe(401);
    asMock(getCurrentAuthContext).mockResolvedValueOnce({ ...admin, isAdmin: false });
    expect((await POST(req({ memberId: REP, managerId: MGR }))).status).toBe(403);
    expect((await POST(req({ memberId: "nope", managerId: MGR }))).status).toBe(400);
    expect(state.updates).toEqual([]);
  });

  it("sets a manager, scoping the write to the caller's company", async () => {
    const res = await POST(req({ memberId: REP, managerId: CEO }));
    expect(res.status).toBe(200);
    expect(state.updates).toEqual([{ patch: { manager_id: CEO }, filters: [["id", REP], ["company_id", "c1"]] }]);
  });

  it("clears a manager with null", async () => {
    expect((await POST(req({ memberId: REP, managerId: null }))).status).toBe(200);
    expect(state.updates[0]!.patch).toEqual({ manager_id: null });
  });

  it("404 for a member or a manager in another company (the read is company-pinned)", async () => {
    expect((await POST(req({ memberId: OTHER_CO, managerId: MGR }))).status).toBe(404);
    expect((await POST(req({ memberId: REP, managerId: OTHER_CO }))).status).toBe(404);
    expect(state.updates).toEqual([]);
  });

  it("409 for self, a loop, or a removed manager", async () => {
    expect((await POST(req({ memberId: REP, managerId: REP }))).status).toBe(409);
    // CEO → MGR → REP; making REP the CEO's manager would close the loop.
    const loop = await POST(req({ memberId: CEO, managerId: REP }));
    expect(loop.status).toBe(409);
    expect((await loop.json()).error).toMatch(/loop/);
    expect((await POST(req({ memberId: REP, managerId: REMOVED }))).status).toBe(409);
    expect(state.updates).toEqual([]);
  });

  it("503 naming migration 0272 when the column does not exist yet", async () => {
    state.readError = { code: "42703", message: "column profiles.manager_id does not exist" };
    const res = await POST(req({ memberId: REP, managerId: MGR }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/0272/);
  });
});
