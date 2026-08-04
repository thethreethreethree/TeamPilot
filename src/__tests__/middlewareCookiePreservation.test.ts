import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { redirectPreservingCookies } from "@/middleware";

/**
 * redirectPreservingCookies is the intermittent-logout guard: when Supabase's getUser() rotates a session
 * cookie onto `response`, a bare NextResponse.redirect() drops those Set-Cookie headers → the browser keeps
 * the stale cookie the server just invalidated → the user is logged out. INVARIANT 20 guards that middleware
 * redirects ROUTE THROUGH this function; these tests guard that the function itself COPIES CORRECTLY — a break
 * that dropped cookie attributes (path/httpOnly/secure) would slip INV20 yet still break sessions silently.
 */
describe("redirectPreservingCookies — intermittent-logout guard (copy correctness)", () => {
  it("carries every rotated cookie onto the redirect, WITH its attributes", () => {
    const response = NextResponse.next();
    response.cookies.set("sb-access-token", "rotated-access", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
    response.cookies.set("sb-refresh-token", "rotated-refresh", { path: "/", httpOnly: true });

    const redirect = redirectPreservingCookies(response, new URL("https://x.test/dashboard"));

    const access = redirect.cookies.get("sb-access-token");
    const refresh = redirect.cookies.get("sb-refresh-token");
    // Values carried over — the core of the fix.
    expect(access?.value).toBe("rotated-access");
    expect(refresh?.value).toBe("rotated-refresh");
    // Attributes carried over — a copy that dropped these would invalidate the session silently.
    expect(access?.httpOnly).toBe(true);
    expect(access?.path).toBe("/");
    expect(access?.secure).toBe(true);
    // It really is a redirect.
    expect([307, 308]).toContain(redirect.status);
  });

  it("proves the necessity: a BARE redirect carries none of the rotated cookies (the bug it fixes)", () => {
    const bare = NextResponse.redirect(new URL("https://x.test/dashboard"));
    expect(bare.cookies.get("sb-access-token")).toBeUndefined();
  });
});
