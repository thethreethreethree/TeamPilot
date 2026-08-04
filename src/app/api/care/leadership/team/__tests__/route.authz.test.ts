import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/care/leadership/team — company-admin-only authz contract.
 *
 * The leadership team snapshot + presence is a company-level view for CEO / COO / admin ONLY
 * (§A11/§A18). The gate is `isAdminRole(profile.role)`. These pin the DENY paths so a regression that
 * drops or weakens the check (exposing the team view to a Member/Lead) fails here — the route had no test
 * before. Sibling of the readouts route.authz test; the team fetches are mocked so passing the gate does
 * not touch the DB.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/care", () => ({
  fetchTeamGrowth: vi.fn(async () => ({})),
  fetchTeamPresence: vi.fn(async () => ({})),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;

function sb(user: { id: string } | null, profile: unknown) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/leadership/team — company-admin-only authz", () => {
  it("401 when unauthenticated", async () => {
    asMock(createClient).mockResolvedValue(sb(null, null));
    expect((await GET()).status).toBe(401);
  });
  it("403 when the profile has no company", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "CEO", company_id: null }));
    expect((await GET()).status).toBe(403);
  });
  it("403 for a non-admin Member (the leader-only gate)", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "Member", company_id: "co1" }));
    expect((await GET()).status).toBe(403);
  });
  it("403 for a Lead — Lead is NOT a company admin", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "Lead", company_id: "co1" }));
    expect((await GET()).status).toBe(403);
  });
  it("passes the gate for CEO / COO / admin (does not 401/403)", async () => {
    for (const role of ["CEO", "COO", "admin"]) {
      asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role, company_id: "co1" }));
      const status = (await GET()).status;
      expect(status, `role ${role} should pass the gate`).not.toBe(403);
      expect(status, `role ${role} should pass the gate`).not.toBe(401);
    }
  });
});
