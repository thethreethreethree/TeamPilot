import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The manager-only gate on /dashboard/schedule/* (founder decision 2026-08-19). A non-manager — or an
 * unauthenticated caller — must be redirected to /dashboard BEFORE any schedule page renders; a manager
 * passes through. This is a security boundary (schedule reads include sick time-off), so it is regression-
 * locked here rather than left to the layout being eyeballed.
 */
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnabled: true }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import ScheduleLayout from "../layout";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const run = () => ScheduleLayout({ children: "PAGE" as unknown as React.ReactNode });

beforeEach(() => { asMock(redirect).mockClear(); });

describe("ScheduleLayout — manager-only gate", () => {
  it("redirects a non-manager to /dashboard (never renders the page)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "Member", isAdmin: false });
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects an unauthenticated caller to /dashboard", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("lets a manager through (no redirect)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    await expect(run()).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
