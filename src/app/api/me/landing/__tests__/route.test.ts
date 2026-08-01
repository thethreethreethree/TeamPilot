import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/me/landing — the login flow calls this to send a returning user to their module home. It's a thin
 * wrapper over resolveUserLanding (which is unit-tested separately), so this locks the WIRING: unauthenticated
 * falls back to /dashboard WITHOUT calling the resolver, and an authed request passes the caller's id + the
 * profile's company_id to resolveUserLanding and returns its result verbatim. (Test-the-consumer, not just the
 * mapping: a wrong arg or a swallowed company_id here would silently mis-land every returning user.)
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/nav/landing", () => ({ resolveUserLanding: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { resolveUserLanding } from "@/lib/nav/landing";
import { GET } from "../route";

const mockSb = (user: { id: string } | null, companyId: string | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: companyId ? { company_id: companyId } : null }) }) }),
    }),
  });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/me/landing", () => {
  it("unauthenticated → /dashboard, and does NOT call the resolver", async () => {
    mockSb(null, null);
    const body = await (await GET()).json();
    expect(body.landing).toBe("/dashboard");
    expect(resolveUserLanding).not.toHaveBeenCalled();
  });

  it("authed → passes (sb, userId, company_id) to resolveUserLanding and returns its result", async () => {
    mockSb({ id: "u1" }, "co1");
    (resolveUserLanding as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("/dashboard/sales-coach");
    const body = await (await GET()).json();
    expect(body.landing).toBe("/dashboard/sales-coach");
    const call = (resolveUserLanding as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toBe("u1"); // userId
    expect(call[2]).toBe("co1"); // company_id from the profile
  });

  it("authed with no company row → passes null company_id (fail-safe, still resolves)", async () => {
    mockSb({ id: "u1" }, null);
    (resolveUserLanding as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("/dashboard");
    await (await GET()).json();
    expect((resolveUserLanding as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2]).toBeNull();
  });
});
