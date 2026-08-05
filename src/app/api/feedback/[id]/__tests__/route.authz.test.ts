import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * PATCH /api/feedback/[id] — company-admin-only authz contract.
 *
 * Updating a feedback item's triage status (triaged / resolved / declined / duplicate) is a company-admin
 * action — the gate is `isAdminRole(profile.role)`, scoped to the caller's own company. These pin the DENY
 * paths so a regression that drops or weakens the check (letting a Member/Lead re-triage feedback) fails
 * here — the route had no test before. The body parse is mocked to a 400 for the admin case, so "passes the
 * gate" is proven (admin reaches readBody → 400) vs "blocked" (non-admin → 403) without touching the DB.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/validate", () => ({
  readBody: vi.fn(),
  FeedbackStatusPatchSchema: {},
}));

import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { PATCH } from "../route";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;

function sb(user: { id: string } | null, profile: unknown) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
    }),
  };
}
const req = () => ({ json: async () => ({}) } as never);
const ctx = () => ({ params: Promise.resolve({ id: "f1" }) } as never);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: body parse returns a 400 NextResponse. A caller PAST the admin gate reaches this and
  // returns 400; a caller blocked BY the gate returns 401/403 before ever reaching it.
  asMock(readBody).mockResolvedValue(NextResponse.json({ error: "bad body" }, { status: 400 }));
});

describe("PATCH /api/feedback/[id] — company-admin-only authz", () => {
  it("401 when unauthenticated", async () => {
    asMock(createClient).mockResolvedValue(sb(null, null));
    expect((await PATCH(req(), ctx())).status).toBe(401);
  });
  it("400 (complete onboarding) when the profile has no company", async () => {
    // A no-company profile gets a distinct "complete onboarding first" 400, not the admin-denial 403.
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "CEO", company_id: null }));
    expect((await PATCH(req(), ctx())).status).toBe(400);
  });
  it("403 for a non-admin Member (cannot re-triage feedback)", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "Member", company_id: "co1" }));
    expect((await PATCH(req(), ctx())).status).toBe(403);
  });
  it("403 for a Lead — Lead is NOT a company admin", async () => {
    asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role: "Lead", company_id: "co1" }));
    expect((await PATCH(req(), ctx())).status).toBe(403);
  });
  it("passes the gate for CEO / COO / admin (reaches body parse, not 403)", async () => {
    for (const role of ["CEO", "COO", "admin"]) {
      asMock(createClient).mockResolvedValue(sb({ id: "u1" }, { role, company_id: "co1" }));
      const status = (await PATCH(req(), ctx())).status;
      expect(status, `role ${role} should pass the gate`).not.toBe(403);
      expect(status, `role ${role} should pass the gate`).not.toBe(401);
    }
  });
});
