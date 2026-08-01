import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Audit F3 (2026-07-10): the team-invite POST must reconcile with the 0098 partial-unique
 * index. A LIVE pending invite → 409. An EXPIRED pending invite → auto-revoke it, THEN
 * insert (the old code fell through and hit a raw unique-violation 500). These tests
 * exercise the handler logic with a mocked supabase — no live DB. Runtime behavior against
 * a real DB + the index is still unverified; this covers the branch logic.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/auth-helpers", () => ({
  getCurrentCompanyId: vi.fn(async () => "co1"),
  isAdminRole: (r: string) => ["CEO", "COO", "admin"].includes(r),
}));
vi.mock("@/lib/supabase/admin", () => ({
  findAuthUserByEmail: vi.fn(async () => null), // no existing member
  createAdminClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

const HOUR = 3600_000;

function fakeSb(existingInvite: { id: string; expires_at: string } | null) {
  const revoke = vi.fn(() => ({ eq: () => ({ is: async () => ({ error: null }) }) }));
  const insertSingle = vi.fn(async () => ({
    data: { id: "inv-new", code: "CODE123" },
    error: null,
  }));
  const selectChain: Record<string, unknown> = {};
  Object.assign(selectChain, {
    eq: () => selectChain,
    is: () => selectChain,
    order: () => selectChain,
    limit: () => ({ maybeSingle: async () => ({ data: existingInvite, error: null }) }),
  });
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => selectChain,
      update: revoke,
      insert: () => ({ select: () => ({ single: insertSingle }) }),
    }),
    _revoke: revoke,
    _insertSingle: insertSingle,
  };
}

function postReq(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => vi.mocked(createClient).mockReset());

describe("POST /api/team — F3 duplicate/expired invite reconciliation", () => {
  it("409s when a LIVE (non-expired) pending invite already exists — no revoke, no insert", async () => {
    const sb = fakeSb({ id: "inv-live", expires_at: new Date(Date.now() + HOUR).toISOString() });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(postReq({ email: "new@x.com", role: "Member" }));
    expect(res.status).toBe(409);
    expect(sb._revoke).not.toHaveBeenCalled();
    expect(sb._insertSingle).not.toHaveBeenCalled();
  });

  it("EXPIRED pending invite → auto-revokes it, then inserts (no 500)", async () => {
    const sb = fakeSb({ id: "inv-exp", expires_at: new Date(Date.now() - HOUR).toISOString() });
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(postReq({ email: "new@x.com", role: "Member" }));
    expect(res.status).toBe(200);
    expect(sb._revoke).toHaveBeenCalledTimes(1); // the expired invite was superseded
    expect(sb._insertSingle).toHaveBeenCalledTimes(1); // and the new invite created
    expect(await res.json()).toEqual({ invitationId: "inv-new", code: "CODE123" });
  });

  it("no existing invite → inserts directly, no revoke", async () => {
    const sb = fakeSb(null);
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(postReq({ email: "new@x.com", role: "Member" }));
    expect(res.status).toBe(200);
    expect(sb._revoke).not.toHaveBeenCalled();
    expect(sb._insertSingle).toHaveBeenCalledTimes(1);
  });
});

/**
 * Privilege-escalation gate (audit 2026-07-13): CEO/COO are both invitable AND admin roles, and
 * accepting such an invite grants company-admin (0114). Neither the route nor the invite-INSERT RLS
 * checked the CALLER's role, so any Member could mint a CEO/COO invitation and escalate a proxy
 * account to admin. The route now requires the caller to be an admin to assign an admin role.
 */
function fakeSbWithCallerRole(callerRole: string | null) {
  const insertSingle = vi.fn(async () => ({ data: { id: "inv-new", code: "CODE123" }, error: null }));
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (t: string) => {
      if (t === "profiles") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: callerRole } }) }) }),
        };
      }
      // team_invitations: no existing pending invite -> straight to insert.
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      });
      return { select: () => chain, insert: () => ({ select: () => ({ single: insertSingle }) }) };
    },
    _insertSingle: insertSingle,
  };
}

describe("POST /api/team — privilege-escalation gate", () => {
  it("403: a NON-admin (Member) may NOT mint a CEO invite — no insert (the escalation is blocked)", async () => {
    const sb = fakeSbWithCallerRole("Member");
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(postReq({ email: "proxy@x.com", role: "CEO" }));
    expect(res.status).toBe(403);
    expect(sb._insertSingle).not.toHaveBeenCalled();
  });

  it("an ADMIN (CEO) MAY invite an admin role — proceeds to insert", async () => {
    const sb = fakeSbWithCallerRole("CEO");
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(postReq({ email: "coo@x.com", role: "COO" }));
    expect(res.status).toBe(200);
    expect(sb._insertSingle).toHaveBeenCalledTimes(1);
  });

  it("a NON-admin MAY invite a non-admin role (Member) — the gate applies only to admin roles", async () => {
    const sb = fakeSbWithCallerRole("Member");
    vi.mocked(createClient).mockResolvedValue(sb as never);
    const res = await POST(postReq({ email: "teammate@x.com", role: "Member" }));
    expect(res.status).toBe(200);
    expect(sb._insertSingle).toHaveBeenCalledTimes(1);
  });
});
