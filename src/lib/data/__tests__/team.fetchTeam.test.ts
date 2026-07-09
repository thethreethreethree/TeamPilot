import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * fetchTeam guards the §3.4 / A14 live-error-vs-live-empty class (same shape as
 * the 2026-07-03 Team Chat outage the fetchTopics test covers). A FAILED read
 * (RLS/DB) must surface as "live-error", NEVER as "live-empty" — because the
 * team page renders live-empty as "No active members. This usually means
 * onboarding hasn't completed", which would be an actively misleading message
 * when the real cause is a query rejection. Before the fix, fetchTeam used
 * `res.data ?? []` and had no "live-error" mode, so any error collapsed to
 * live-empty. These cases pin the four outcomes.
 */
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
  supabaseEnabled: true,
}));

import { createClient } from "@/lib/supabase/client";
import { fetchTeam } from "../team";

const MEMBER_ROW = {
  id: "u1",
  full_name: "Ada Member",
  role: "member",
  status: "active",
  removed_at: null,
  created_at: "2026-07-01T00:00:00Z",
};

const INVITE_ROW = {
  id: "i1",
  email: "new@x.com",
  role: "member",
  code: "abc123",
  invited_at: "2026-07-02T00:00:00Z",
  expires_at: "2026-07-09T00:00:00Z",
  accepted_at: null,
  revoked_at: null,
};

function mock(byTable: Record<string, unknown>, calls: Array<[string, unknown[]]>) {
  vi.mocked(createClient).mockReturnValue(makeSupabaseClient(byTable, calls) as never);
}

describe("fetchTeam (live-error vs live-empty guard)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
  });

  it("returns live-data when reads succeed with rows", async () => {
    mock(
      {
        profiles: { data: [MEMBER_ROW], error: null },
        team_invitations: { data: [INVITE_ROW], error: null },
      },
      calls
    );
    const out = await fetchTeam();
    expect(out.mode).toBe("live-data");
    expect(out.members).toHaveLength(1);
    expect(out.members[0]).toMatchObject({ id: "u1", fullName: "Ada Member" });
    expect(out.invitations).toHaveLength(1);
  });

  it("returns live-empty on a genuine no-rows read (data present, length 0)", async () => {
    mock(
      {
        profiles: { data: [], error: null },
        team_invitations: { data: [], error: null },
      },
      calls
    );
    const out = await fetchTeam();
    expect(out.mode).toBe("live-empty");
    expect(out.members).toEqual([]);
  });

  it("surfaces live-error (NOT live-empty) when the profiles read fails", async () => {
    mock(
      {
        profiles: { data: null, error: { code: "42501", message: "permission denied" } },
        team_invitations: { data: [], error: null },
      },
      calls
    );
    const out = await fetchTeam();
    expect(out.mode).toBe("live-error"); // the bug was this collapsing to live-empty
  });

  it("surfaces live-error when the invitations read fails (either query counts)", async () => {
    mock(
      {
        profiles: { data: [MEMBER_ROW], error: null },
        team_invitations: { data: null, error: { code: "42P01", message: "relation missing" } },
      },
      calls
    );
    const out = await fetchTeam();
    expect(out.mode).toBe("live-error");
  });
});
