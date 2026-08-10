import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/sales-session/team — grants a member's sales_coach_role (admin | staff | null). Previously
 * untested, and it's a PRIVILEGE-ESCALATION surface: promoting someone to sales_coach admin makes them a
 * manager. The boundaries: only a manager may call it (a rep can't self-promote); the write is scoped to the
 * caller's OWN company (a manager can't reach into another tenant); and a 0-row write is an honest 404, never a
 * phantom success. isSalesCoachManager + the zod body are the real implementations; the admin write is captured.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, POST } from "../route";

const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

/** Capture the update payload + .eq scoping; `rows` is what the scoped update returns (0 rows = cross-company). */
const captured: { patch?: unknown; eqs: Array<{ col: string; val: unknown }> } = { eqs: [] };
const mockAdmin = (rows: Array<{ id: string }>) =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.update = (patch: unknown) => {
        captured.patch = patch;
        return chain;
      };
      chain.eq = (col: string, val: unknown) => {
        captured.eqs.push({ col, val });
        return chain;
      };
      chain.select = async () => ({ data: rows, error: null });
      return chain;
    },
  });

const ID = "11111111-1111-4111-8111-111111111111";
const postReq = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];
const REP = { role: "member", company_id: "co1", sales_coach_role: null };
const MANAGER = { role: "admin", company_id: "co1", sales_coach_role: null };

beforeEach(() => {
  vi.clearAllMocks();
  captured.patch = undefined;
  captured.eqs = [];
});

describe("POST /team — role-grant gate", () => {
  it("403 for a rep, and NO role write happens (can't self-promote)", async () => {
    setCaller("rep1", REP);
    mockAdmin([{ id: ID }]);
    const res = await POST(postReq({ id: ID, salesCoachRole: "admin" }));
    expect(res.status).toBe(403);
    expect(captured.patch).toBeUndefined();
  });

  it("400 on an invalid body (bad role / non-uuid id) before any write", async () => {
    setCaller("boss", MANAGER);
    mockAdmin([{ id: ID }]);
    expect((await POST(postReq({ id: ID, salesCoachRole: "superadmin" }))).status).toBe(400);
    expect((await POST(postReq({ id: "not-a-uuid", salesCoachRole: "admin" }))).status).toBe(400);
    expect(captured.patch).toBeUndefined();
  });

  it("200 for a manager promoting a SAME-company member — write is company-scoped", async () => {
    setCaller("boss", MANAGER);
    mockAdmin([{ id: ID }]); // the scoped update matched a row
    const res = await POST(postReq({ id: ID, salesCoachRole: "admin" }));
    expect(res.status).toBe(200);
    expect(captured.patch).toEqual({ sales_coach_role: "admin" });
    expect(captured.eqs).toContainEqual({ col: "id", val: ID });
    expect(captured.eqs).toContainEqual({ col: "company_id", val: "co1" }); // tenant scope on the write
  });

  it("404 when the target isn't in the manager's company (0 rows — no phantom success)", async () => {
    setCaller("boss", MANAGER);
    mockAdmin([]); // company-scoped update matched nothing → cross-company target
    expect((await POST(postReq({ id: ID, salesCoachRole: "admin" }))).status).toBe(404);
  });
});

/**
 * GET returns the roster + PENDING invites so the Team page can make the two-step (invite → assign Staff) visible.
 * Guards: expired invitations are hidden (they still occupy the unique slot until revoked), and a read error is an
 * honest 500 (never an empty team as if the company had no members — the error-as-no-data discipline).
 */
function getClient(opts: {
  profile: unknown;
  members: Array<Record<string, unknown>>;
  invites: Array<Record<string, unknown>>;
  membersErr?: unknown;
  invitesErr?: unknown;
}) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "boss" } } }) },
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "order"]) q[m] = () => q;
      (q as { maybeSingle: unknown }).maybeSingle = async () => ({ data: opts.profile });
      (q as { then: unknown }).then = (res: (v: unknown) => void) =>
        res(
          table === "team_invitations"
            ? { data: opts.invites, error: opts.invitesErr ?? null }
            : { data: opts.members, error: opts.membersErr ?? null }
        );
      return q;
    },
  };
}

describe("GET /team — roster + pending invites", () => {
  it("returns members and only NON-expired pending invites", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      getClient({
        profile: MANAGER,
        members: [{ id: ID, full_name: "Rep One", role: "member", sales_coach_role: "staff" }],
        invites: [
          { id: "i1", email: "new@co.com", invited_at: "2026-08-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z" },
          { id: "i2", email: "old@co.com", invited_at: "2026-07-01T00:00:00Z", expires_at: "2000-01-01T00:00:00Z" },
        ],
      }) as never
    );
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.members).toHaveLength(1);
    // the live invite is surfaced; the expired one (i2) is hidden
    expect(body.pendingInvites).toEqual([
      { id: "i1", email: "new@co.com", invitedAt: "2026-08-01T00:00:00Z" },
    ]);
  });

  it("500 on a read error — an honest failure, not an empty team", async () => {
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      getClient({ profile: MANAGER, members: [], invites: [], membersErr: { message: "timeout" } }) as never
    );
    expect((await GET()).status).toBe(500);
  });
});
