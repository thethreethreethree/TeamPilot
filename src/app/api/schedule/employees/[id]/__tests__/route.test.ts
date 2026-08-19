import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Staff update route (R5-1). Pins: manager-only (a non-manager gets 403, no write), the update is pinned to
 * the caller's company (id AND company_id — a no-match is a 404, never a cross-tenant edit), an empty/invalid
 * body is rejected, and a deactivate flips status to inactive so isEligible stops scheduling the person.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { PATCH } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const U = "11111111-1111-4111-8111-111111111111";
const manager = { userId: "u1", companyId: "c1", role: "admin", isAdmin: true };
const member = { userId: "u2", companyId: "c1", role: "Member", isAdmin: false };

function req(body: unknown) {
  return { json: async () => body, headers: new Headers() } as unknown as Parameters<typeof PATCH>[0];
}
const ctxArg = (id: string) => ({ params: Promise.resolve({ id }) }) as Parameters<typeof PATCH>[1];

let updateArg: Record<string, unknown> | null = null;
let companyEq: string | null = null;
function fakeSb(result: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      update: (p: Record<string, unknown>) => {
        updateArg = p;
        return {
          eq: (_col: string, _v: string) => ({
            eq: (_col2: string, v2: string) => {
              companyEq = v2;
              return { select: () => ({ maybeSingle: async () => result }) };
            },
          }),
        };
      },
    }),
  };
}
const row = (over: Record<string, unknown> = {}) => ({
  id: U, company_id: "c1", name: "Alex", role: "nurse", employment_type: null,
  skills: [], certifications: [], max_hours_week: null, min_hours_week: null, status: "active", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  updateArg = null;
  companyEq = null;
  asMock(createClient).mockResolvedValue(fakeSb({ data: row({ status: "inactive" }), error: null }));
});

describe("PATCH /api/schedule/employees/[id]", () => {
  it("a MANAGER deactivates a staff member (200, status inactive, pinned to their company)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    const res = await PATCH(req({ status: "inactive" }), ctxArg(U));
    expect(res.status).toBe(200);
    expect((await res.json()).employee.status).toBe("inactive");
    expect(updateArg).toEqual({ status: "inactive" });
    expect(companyEq).toBe("c1"); // tenant-pin: update scoped to the caller's company
  });

  it("a NON-manager cannot update (403, no write)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(member);
    expect((await PATCH(req({ status: "inactive" }), ctxArg(U))).status).toBe(403);
    expect(updateArg).toBeNull();
  });

  it("401 unauthenticated; 400 on an invalid id or an empty body", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await PATCH(req({ status: "inactive" }), ctxArg(U))).status).toBe(401);
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    expect((await PATCH(req({ status: "inactive" }), ctxArg("not-a-uuid"))).status).toBe(400);
    expect((await PATCH(req({}), ctxArg(U))).status).toBe(400); // no fields to update
  });

  it("a no-match (wrong id / another company's staff) is a 404, never a cross-tenant edit", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(manager);
    asMock(createClient).mockResolvedValue(fakeSb({ data: null, error: null }));
    expect((await PATCH(req({ status: "inactive" }), ctxArg(U))).status).toBe(404);
  });
});
