import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Homepage (`/`) routing — the SERVER-component consumer of resolveUserLanding (which is unit-tested
 * separately in src/lib/nav/__tests__/landing.test.ts). This locks the WIRING that the resolver's own
 * tests can't see: a signed-OUT visitor gets the marketing landing WITHOUT ever touching the resolver
 * or a redirect, and a signed-IN account is redirected to its resolved module home with the caller's id
 * + the profile's company_id passed through. (Test-the-consumer, not just the mapping — a swallowed
 * company_id or an inverted branch here would either show marketing to a logged-in user or mis-land
 * every account, and neither is visible from resolveUserLanding's own unit tests.)
 *
 * redirect() is mocked to THROW like the real next/navigation redirect (which never returns), so the
 * signed-in assertions also prove control-flow stops at the redirect (LandingPage is never rendered for
 * an authed user).
 */
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/nav/landing", () => ({ resolveUserLanding: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/components/landing/LandingPage", () => ({ LandingPage: () => null }));

import { createClient } from "@/lib/supabase/server";
import { resolveUserLanding } from "@/lib/nav/landing";
import { redirect } from "next/navigation";
import Home from "../page";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;

const mockSb = (user: { id: string } | null, companyId: string | null) =>
  asMock(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: companyId ? { company_id: companyId } : null }),
        }),
      }),
    }),
  });

beforeEach(() => vi.clearAllMocks());

describe("Home (`/`) routing", () => {
  it("signed-out visitor gets the marketing landing — no resolver call, no redirect", async () => {
    mockSb(null, null);
    const el = await Home();
    expect(el).toBeTruthy(); // the <LandingPage/> element, not a redirect
    expect(resolveUserLanding).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("signed-in account is redirected to its resolved module home (id + company_id passed through)", async () => {
    mockSb({ id: "u1" }, "co1");
    asMock(resolveUserLanding).mockResolvedValue("/dashboard/sales-coach");
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/dashboard/sales-coach");
    expect(redirect).toHaveBeenCalledWith("/dashboard/sales-coach");
    const call = asMock(resolveUserLanding).mock.calls[0] ?? [];
    expect(call[1]).toBe("u1"); // userId
    expect(call[2]).toBe("co1"); // company_id from the profile
  });

  it("signed-in with no profile company row → passes null company_id (fail-safe, still resolves)", async () => {
    mockSb({ id: "u1" }, null);
    asMock(resolveUserLanding).mockResolvedValue("/dashboard");
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect((asMock(resolveUserLanding).mock.calls[0] ?? [])[2]).toBeNull();
  });
});
