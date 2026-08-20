import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
const insertSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: insertSingle }) }),
      select: () => ({ eq: () => ({ is: () => ({ order: () => ({ data: [], error: null }) }) }) }),
    }),
  }),
}));

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { POST, GET } from "../route";
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];
const admin = { userId: "u1", companyId: "c1", role: "admin", isAdmin: true };

beforeEach(() => vi.clearAllMocks());

describe("POST /api/team/passwords", () => {
  it("401 unauthenticated, 403 non-admin", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ title: "T", secret: "Team@2026" }))).status).toBe(401);
    asMock(getCurrentAuthContext).mockResolvedValue({ ...admin, isAdmin: false });
    expect((await POST(req({ title: "T", secret: "Team@2026" }))).status).toBe(403);
  });
  it("rejects a weak team password (policy enforced) with 400", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    const res = await POST(req({ title: "Sales", secret: "weakpass" })); // no upper/digit/special
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/uppercase|number|special/i);
  });
  it("creates a strong password (200) — company pinned, secret returned for distribution", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(admin);
    insertSingle.mockResolvedValue({ data: { id: "p1", title: "Sales", secret: "Team@2026", created_at: "x" }, error: null });
    const res = await POST(req({ title: "Sales", secret: "Team@2026" }));
    expect(res.status).toBe(200);
    expect((await res.json()).password.secret).toBe("Team@2026");
  });
  it("GET is admin-gated (403 non-admin)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ ...admin, isAdmin: false });
    expect((await GET()).status).toBe(403);
  });
});
