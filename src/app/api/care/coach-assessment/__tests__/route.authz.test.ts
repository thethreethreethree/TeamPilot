import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/care/coach-assessment — company-admin-only authz contract.
 *
 * The coach-assessment roster (each rep's coaching notes + ELO) is a manager/leadership view gated to
 * CEO / COO / admin (§A18 — surfacing team-member data to a leader; the label + the gate are the defense).
 * The gate is `isAdminRole(profile.role)`. These pin the DENY paths so a regression that weakens the check
 * (exposing the roster to a Member/Lead) fails here — the route had no test before. Roster fetch mocked so
 * passing the gate does not touch the DB.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/careCoachAssessment", () => ({
  fetchCoachAssessmentRoster: vi.fn(async () => ({ team: [] })),
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

describe("GET /api/care/coach-assessment — company-admin-only authz", () => {
  it("401 when unauthenticated", async () => {
    asMock(createClient).mockResolvedValue(sb(null, null));
    expect((await GET()).status).toBe(401);
  });
  it("403 when the profile has no company", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "CEO", company_id: null }));
    expect((await GET()).status).toBe(403);
  });
  it("403 for a non-admin Member", async () => {
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
