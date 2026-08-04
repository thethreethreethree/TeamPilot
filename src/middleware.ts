import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import { decideAuthRedirect } from "@/lib/auth/routeGuard";
import { lockFromPilotModule, redirectForLock } from "@/lib/auth/moduleAccess";

/**
 * Redirect while carrying over any auth cookies Supabase rotated onto `response` this request.
 *
 * The `setAll` callback below accumulates refreshed session cookies onto `response` when `getUser()` renews an
 * expiring token. A bare `NextResponse.redirect(url)` is a FRESH response that drops those Set-Cookie headers —
 * the documented Supabase-SSR footgun: the browser keeps the pre-rotation cookie, the server may have already
 * invalidated it, and the user gets intermittently logged out. Every redirect that can follow a token refresh
 * must copy the cookies over. Centralized here so a future redirect can't silently reintroduce the drop.
 * (Found by the 2026-08-01 adversarial middleware audit: the module-lock redirect fires on the hot `/dashboard`
 * path, which turned this latent bug into a frequent one.)
 */
// Exported for unit testing the copy correctness (its USAGE is guarded by INVARIANT 20; this makes the copy
// LOGIC itself testable — a break that drops cookie ATTRIBUTES would slip INV20 yet still log users out).
// Next only reads the `middleware`/`config` exports; extra named exports are ignored by the convention.
export function redirectPreservingCookies(response: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

/**
 * Refreshes the Supabase session on every request and guards routes:
 *  - unauthenticated users hitting /dashboard or /onboarding are sent to /login
 *  - authenticated users hitting /login are sent to /dashboard
 *  - MODULE HARD-LOCK (0207): a single-module account (companies.access_module = care|sales_coach) may only
 *    reach its module's subtree; any other /dashboard route silently redirects to its module home. A complete
 *    (null access_module) or legacy account is unaffected.
 *
 * In demo mode (no Supabase env vars) auth is skipped so the UI is still browsable.
 */
export async function middleware(request: NextRequest) {
  if (!supabaseEnabled) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route-protection decision extracted to a pure, unit-tested function
  // (src/lib/auth/routeGuard.ts) so its security invariants can't silently
  // regress — including through the pending middleware→proxy migration (8f).
  const dest = decideAuthRedirect({
    hasUser: !!user,
    path: request.nextUrl.pathname,
    search: request.nextUrl.search, // preserve the deep link's query into ?next=
  });
  if (dest) {
    return redirectPreservingCookies(response, new URL(dest, request.url));
  }

  // MODULE HARD-LOCK (0207). Only for an authed user on a /dashboard route. One nested query reads the
  // caller's company access_module (RLS-bound: a member can SELECT their own company). Fail-OPEN — a
  // transient error / missing row → no lock, so a hiccup never locks a legitimate user out (RLS still
  // protects data; this gate is product-scoping, not a data boundary).
  if (user && request.nextUrl.pathname.startsWith("/dashboard")) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("companies(access_module)")
        .eq("id", user.id)
        .maybeSingle();
      const company = (profile?.companies ?? null) as { access_module?: string | null } | null;
      const lock = lockFromPilotModule(company?.access_module ?? null);
      const to = redirectForLock(lock, request.nextUrl.pathname);
      if (to) {
        return redirectPreservingCookies(response, new URL(to, request.url));
      }
    } catch {
      // Fail-open: never lock a user out on a lookup error.
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/login",
    // So the authed-user redirect on the branded login (above) actually
    // runs — without this entry the middleware never fires there.
    "/sales-coach/login",
  ],
};
