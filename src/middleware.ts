import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import { decideAuthRedirect } from "@/lib/auth/routeGuard";
import { lockFromPilotModule, redirectForLock } from "@/lib/auth/moduleAccess";
import { isMfaExempt, mfaHold, mfaVerdict, MFA_REQUIRED_MESSAGE } from "@/lib/auth/mfa";

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

  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  // MULTI-FACTOR SIGN-IN (2026-11-23). API requests are matched only so a session that still owes its code is refused
  // in front of all 395 routes (most identify the caller themselves, many then use the service role). A request with no
  // session cookie — cron, a mobile/extension Bearer token — passes untouched and costs nothing; resolveApiAuth applies
  // the same rule to Bearer tokens.
  if (isApi) {
    const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    if (!hasSessionCookie || isMfaExempt(path)) return NextResponse.next({ request });
  }

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

  if (isApi) {
    // getClaims verifies the access token locally (the project signs with an asymmetric ES256 key) — no network call per
    // API request. Only the signed claims are trusted, never the cookie's user object (lib/auth/mfa.ts).
    const { data: claimData } = await supabase.auth.getClaims();
    if (mfaVerdict(claimData?.claims) === "needs_code") {
      const refused = NextResponse.json({ error: MFA_REQUIRED_MESSAGE, mfa: true }, { status: 401 });
      response.cookies.getAll().forEach((cookie) => refused.cookies.set(cookie));
      return refused;
    }
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A signed-in person who turned on multi-factor sign-in and has not entered a code this session is held at the code
  // screen; every page except sign-in and the code screen itself waits for it.
  if (user && !isMfaExempt(path)) {
    const { data: claimData } = await supabase.auth.getClaims();
    if (mfaVerdict(claimData?.claims) === "needs_code") {
      const hold = mfaHold(path, request.nextUrl.search);
      if (hold.kind === "redirect") return redirectPreservingCookies(response, new URL(hold.to, request.url));
    }
  }

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
    // Multi-factor sign-in: the extension's connect page only (2026-11-27; not its privacy / download pages) — it hands the session to the Chrome extension,
    // so a session that still owes its code is held at the code screen first; the extension then gets a session that
    // has passed it, instead of one every API route refuses (OPEN.md 2026-11-23 "no code step" — the extension half).
    "/extension/connect",
    // Multi-factor sign-in: every API route, so a session that owes its code is refused in front of all of them. Requests
    // without a session cookie return at once (see the top of middleware()).
    "/api/:path*",
  ],
};
