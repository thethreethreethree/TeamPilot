/**
 * Pure auth-redirect decision for the request middleware.
 *
 * This is the route-protection gate, extracted OUT of `src/middleware.ts` so its
 * security invariants are unit-testable and locked by tests — an IO-wrapped
 * `middleware()` (it refreshes the Supabase session) can't be exercised cheaply,
 * but the decision "given auth state + path, redirect where (if anywhere)?" is
 * pure and is the part that must never silently regress.
 *
 * Behaviour is IDENTICAL to the inline logic it replaced. It also de-risks the
 * pending `middleware` → `proxy` file-convention migration (Next 16 deprecation,
 * FOUNDER-ACTION-QUEUE 8f): after the rename, these tests still prove the gate
 * fires. Keep this in sync with `middleware.ts`'s `config.matcher`.
 */

export interface AuthRedirectInput {
  /** Whether the request carries an authenticated Supabase user. */
  hasUser: boolean;
  /** `request.nextUrl.pathname`. */
  path: string;
}

/**
 * Returns the destination path to redirect to, or `null` to let the request
 * proceed. Callers redirect iff this is non-null.
 *
 * Invariants (locked by routeGuard.test.ts):
 *  - Unauthenticated + a protected route (`/dashboard*`, `/onboarding*`) → login.
 *    Sales-Coach deep-links bounce to the BRANDED login (`/sales-coach/login`),
 *    everything else to `/login`, so the product keeps its own entry.
 *  - Authenticated + a login page → into the app (so a logged-in user never sees
 *    the login form): `/login` → `/dashboard`, `/sales-coach/login` →
 *    `/dashboard/sales-coach`.
 *  - Otherwise → `null` (proceed).
 */
export function decideAuthRedirect({ hasUser, path }: AuthRedirectInput): string | null {
  const isProtected =
    path.startsWith("/dashboard") || path.startsWith("/onboarding");

  if (!hasUser && isProtected) {
    // Sales-Coach deep-links bounce to the branded login. (Its page doesn't yet honor ?next= — a follow-up;
    // threading it needs sales-coach/login updated too.)
    if (path.startsWith("/dashboard/sales-coach")) {
      return "/sales-coach/login";
    }
    // Preserve the intended destination so a post-login redirect returns the user THERE, not the generic
    // dashboard — deep-link continuity (an agent's bookmarked /dashboard/care/* survives the login bounce;
    // this is the same class as the extension connect flow's ?next=). /login honors ?next= behind an
    // open-redirect guard (safeRelativePath); `path` is a same-origin pathname by construction, encoded here.
    return `/login?next=${encodeURIComponent(path)}`;
  }

  if (hasUser && path === "/login") {
    return "/dashboard";
  }

  if (hasUser && path === "/sales-coach/login") {
    return "/dashboard/sales-coach";
  }

  return null;
}
