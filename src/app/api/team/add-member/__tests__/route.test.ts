import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
const findByEmail = vi.fn();
const upsert = vi.fn();
const tpSingle = vi.fn();
const createUser = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  findAuthUserByEmail: (e: string) => findByEmail(e),
  createAdminClient: () => ({
    from: () => ({
      upsert: (v: unknown) => upsert(v),
      select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ single: tpSingle }) }) }) }),
    }),
    auth: { admin: { createUser: (a: unknown) => createUser(a), deleteUser: async () => ({}) } },
  }),
}));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];
const admin = { userId: "u1", companyId: "c1", role: "admin", isAdmin: true };

beforeEach(() => vi.clearAllMocks());

describe("POST /api/team/add-member", () => {
  it("401 unauth, 403 non-admin", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ mode: "existing", email: "a@b.com" }))).status).toBe(401);
    asMock(getCurrentAuthContext).mockResolvedValue({ ...admin, isAdmin: false });
    expect((await POST(req({ mode: "existing", email: "a@b.com" }))).status).toBe(403);
  });
  it("existing mode: unknown email → 404 (guide to add as new)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    findByEmail.mockResolvedValue(null);
    expect((await POST(req({ mode: "existing", email: "nobody@x.com" }))).status).toBe(404);
  });
  it("existing mode: known email → upsert to THIS company (pinned), 200", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    findByEmail.mockResolvedValue({ id: "u9", email: "a@b.com" });
    upsert.mockResolvedValue({ error: null });
    const res = await POST(req({ mode: "existing", email: "a@b.com", salesCoachRole: "staff" }));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "u9", company_id: "c1", sales_coach_role: "staff" }));
  });
  it("new mode: email already has an account → 409", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    findByEmail.mockResolvedValue({ id: "u9", email: "a@b.com" });
    expect((await POST(req({ mode: "new", email: "a@b.com", teamPasswordId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" }))).status).toBe(409);
  });
  it("new mode: creates user with the team password + sets must_change_password", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    findByEmail.mockResolvedValue(null);
    tpSingle.mockResolvedValue({ data: { secret: "Team@2026" }, error: null });
    createUser.mockResolvedValue({ data: { user: { id: "u10" } }, error: null });
    upsert.mockResolvedValue({ error: null });
    const res = await POST(req({ mode: "new", email: "new@x.com", teamPasswordId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", salesCoachRole: null }));
    expect(res.status).toBe(200);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "new@x.com", password: "Team@2026", email_confirm: true }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "u10", company_id: "c1", must_change_password: true }));
  });
});
