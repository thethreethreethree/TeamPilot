import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/care/leadership/readouts — company-admin-only authz contract.
 *
 * The Phase-7 §4 readouts are company-level analytics visible to CEO / COO / admin ONLY (§A11/§A18 —
 * a leader deciding whether to keep investing in a methodology, NOT agent surveillance). The gate is
 * `isAdminRole(profile.role)`. These pin the DENY paths so a regression that drops or weakens the check
 * (exposing a leader-only readout to a Member/Lead) fails here — the route had no test before. Mirrors the
 * notify-message route.authz.test.ts mocking pattern. The admin-path fetches are mocked so passing the
 * gate does not touch the DB.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/care", () => ({
  fetchCoachRubricReadout: vi.fn(async () => ({})),
  fetchCoPilotValueReadout: vi.fn(async () => ({})),
  fetchPatternResolutionReadout: vi.fn(async () => ({})),
  fetchRoutingReadout: vi.fn(async () => ({})),
  fetchSlaWithDurabilityReadout: vi.fn(async () => ({})),
  fetchVoiceValueReadout: vi.fn(async () => ({})),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;

/** Mock Supabase: an auth user + the profiles.role/company_id read. */
function sb(user: { id: string } | null, profile: unknown) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
    }),
  };
}
const req = (windowDays = "60") =>
  ({ nextUrl: { searchParams: new URLSearchParams({ windowDays }) } } as never);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/care/leadership/readouts — company-admin-only authz", () => {
  it("401 when unauthenticated", async () => {
    asMock(createClient).mockResolvedValue(sb(null, null));
    expect((await GET(req())).status).toBe(401);
  });
  it("403 when the profile has no company", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "CEO", company_id: null }));
    expect((await GET(req())).status).toBe(403);
  });
  it("403 for a non-admin Member (the leader-only gate)", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "Member", company_id: "co1" }));
    expect((await GET(req())).status).toBe(403);
  });
  it("403 for a Lead — Lead is NOT a company admin", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "Lead", company_id: "co1" }));
    expect((await GET(req())).status).toBe(403);
  });
  it("passes the gate for CEO / COO / admin (does not 401/403)", async () => {
    for (const role of ["CEO", "COO", "admin"]) {
      asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role, company_id: "co1" }));
      const status = (await GET(req())).status;
      expect(status, `role ${role} should pass the gate`).not.toBe(403);
      expect(status, `role ${role} should pass the gate`).not.toBe(401);
    }
  });
});
