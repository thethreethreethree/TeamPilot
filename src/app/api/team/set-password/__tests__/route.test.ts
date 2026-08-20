import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
const updateUserById = vi.fn();
const flagUpdate = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { updateUserById: (id: string, a: unknown) => updateUserById(id, a) } },
    from: () => ({ update: (v: unknown) => ({ eq: () => flagUpdate(v) }) }),
  }),
}));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST } from "../route";
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => vi.clearAllMocks());

describe("POST /api/team/set-password", () => {
  it("401 unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ password: "Team@2026" }))).status).toBe(401);
  });
  it("rejects a weak password (400)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "Member", isAdmin: false });
    expect((await POST(req({ password: "weakpass" }))).status).toBe(400);
  });
  it("sets the caller's OWN password (id from session) + clears the flag", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "Member", isAdmin: false });
    updateUserById.mockResolvedValue({ error: null });
    flagUpdate.mockResolvedValue({ error: null });
    const res = await POST(req({ password: "Team@2026" }));
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("u1", { password: "Team@2026" });
    expect(flagUpdate).toHaveBeenCalledWith({ must_change_password: false });
  });
});
