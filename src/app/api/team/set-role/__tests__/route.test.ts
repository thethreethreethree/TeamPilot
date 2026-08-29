import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/team/set-role — set a member's org tier (the `role` field). Locks the security + safety seams:
 * 400 on a non-assignable role, 401 unauth, 403 non-admin, 404 when the member isn't in the caller's company
 * (INV15 tenant-pin), 409 when the change would remove the company's LAST admin (lockout guard), and 200 on a
 * valid change. getCurrentAuthContext + the admin client are mocked; the zod Body + branch logic are REAL.
 */
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

const targetLookup = vi.fn(); // the target profile { role, company_id }
const adminCount = vi.fn(); // { count } of company admins
const updateResult = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: (_cols?: unknown, opts?: { head?: boolean }) =>
        opts?.head
          ? { eq: () => ({ in: async () => adminCount() }) } // admin count query
          : { eq: () => ({ maybeSingle: async () => targetLookup() }) }, // target lookup
      update: () => ({ eq: () => ({ eq: async () => updateResult() }) }),
    }),
  }),
}));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const admin = { userId: "u1", companyId: "c1", role: "CEO", isAdmin: true };
const MID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  updateResult.mockResolvedValue({ error: null });
});

describe("POST /team/set-role", () => {
  it("401 when unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ memberId: MID, role: "Manager" }))).status).toBe(401);
  });

  it("403 for a non-admin caller", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ ...admin, isAdmin: false });
    expect((await POST(req({ memberId: MID, role: "Manager" }))).status).toBe(403);
  });

  it("400 on a role outside the assignable set (before any write)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    expect((await POST(req({ memberId: MID, role: "Wizard" }))).status).toBe(400);
    expect(updateResult).not.toHaveBeenCalled();
  });

  it("404 when the member isn't in the caller's company (tenant-pin)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    targetLookup.mockResolvedValue({ data: { role: "Member", company_id: "OTHER" } });
    expect((await POST(req({ memberId: MID, role: "Manager" }))).status).toBe(404);
    expect(updateResult).not.toHaveBeenCalled();
  });

  it("409 refuses demoting the company's LAST admin (lockout guard)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    targetLookup.mockResolvedValue({ data: { role: "CEO", company_id: "c1" } }); // an admin
    adminCount.mockResolvedValue({ count: 1 }); // the only one
    const res = await POST(req({ memberId: MID, role: "Manager" })); // Manager is not admin
    expect(res.status).toBe(409);
    expect(updateResult).not.toHaveBeenCalled();
  });

  it("200 demotes an admin when another admin remains", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    targetLookup.mockResolvedValue({ data: { role: "CEO", company_id: "c1" } });
    adminCount.mockResolvedValue({ count: 2 });
    const res = await POST(req({ memberId: MID, role: "Manager" }));
    expect(res.status).toBe(200);
    expect(updateResult).toHaveBeenCalledTimes(1);
  });

  it("200 on a non-demotion change without checking the admin count", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    targetLookup.mockResolvedValue({ data: { role: "Member", company_id: "c1" } });
    const res = await POST(req({ memberId: MID, role: "Director" }));
    expect(res.status).toBe(200);
    expect(adminCount).not.toHaveBeenCalled(); // wasAdmin=false → no last-admin check
    expect(updateResult).toHaveBeenCalledTimes(1);
  });
});
