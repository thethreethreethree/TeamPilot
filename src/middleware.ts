import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import { decideAuthRedirect } from "@/lib/auth/routeGuard";

/**
 * Refreshes the Supabase session on every request and guards routes:
 *  - unauthenticated users hitting /dashboard or /onboarding are sent to /login
 *  - authenticated users hitting /login are sent to /dashboard
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
  });
  if (dest) {
    return NextResponse.redirect(new URL(dest, request.url));
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
