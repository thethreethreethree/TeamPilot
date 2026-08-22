/**
 * Module hard-lock — pure path logic (founder decision 2026-08-01).
 *
 * A pilot code provisions an account for ONE module (care | sales_coach | elostate=complete). The founder's
 * decision: a single-module account is HARD-LOCKED — it lands in its module, sees only that module's nav, and
 * is silently redirected to its module home if it requests any route outside it. A "complete" (elostate)
 * account, or a legacy account with no pilot code, has NO lock (full hub access).
 *
 * This file is PURE + unit-tested: the path ↔ module mapping and the allow/redirect decision have no IO, so
 * the enforcement layer (a server layout guard) can rely on a tested core. The DB lookup that resolves an
 * account's lock lives separately (moduleLockForCompany), keyed on the reliable signal — the redeemed pilot
 * code's module — NOT care_tenant_config existence (0045 auto-creates that for every company, so it can't
 * distinguish a C.A.R.E account from any other).
 */

/** The two lockable single modules. `null` everywhere means "no lock — full hub access" (complete/legacy). */
export type LockedModule = "care" | "sales_coach";

/** Which module a dashboard path belongs to. "elostate" = the shared hub / any non-module route. */
export type PathModule = LockedModule | "elostate";

// The module home routes — the SINGLE source for these two paths. `src/lib/nav/landing.ts`'s MODULE_LANDING
// imports them (rather than re-typing the map), so the "where a module lives" path can't drift between the
// middleware guard and the login/redeem landing (the A21 "one concept, two encodings" class).
export const SALES_COACH_ROOT = "/dashboard/sales-coach";
export const CARE_ROOT = "/dashboard/care";
// Meeting Coach (Team-Sync) lives at a top-level route but is part of the SALES_COACH entitlement (founder
// 2026-08-23 go-live): it reuses the Sales Coach engine + its components live under sales-coach/, and the Sales
// Coach shell surfaces it. So a sales_coach-locked account may reach it; without this classification the
// single-module lock (0207) would silently redirect them away (moduleForPath would call it the elostate hub).
export const MEETING_COACH_ROOT = "/dashboard/meeting-coach";

/**
 * The module a path belongs to. A path is a module's iff it IS the module root or sits under it (`root/`), so
 * `/dashboard/sales-coach-x` is NOT mistaken for the sales-coach subtree. Everything else is the elostate hub.
 */
export function moduleForPath(pathname: string): PathModule {
  if (pathname === SALES_COACH_ROOT || pathname.startsWith(SALES_COACH_ROOT + "/")) return "sales_coach";
  // Meeting Coach is bundled with the sales_coach entitlement (see MEETING_COACH_ROOT).
  if (pathname === MEETING_COACH_ROOT || pathname.startsWith(MEETING_COACH_ROOT + "/")) return "sales_coach";
  if (pathname === CARE_ROOT || pathname.startsWith(CARE_ROOT + "/")) return "care";
  return "elostate";
}

/** A locked account's module home — where it lands and where strays are redirected. */
export function moduleHome(lock: LockedModule): string {
  return lock === "sales_coach" ? SALES_COACH_ROOT : CARE_ROOT;
}

/**
 * May an account with this lock view this path? `null` lock → always (full access). A locked account may view
 * ONLY its own module's subtree — hub/other-module routes are denied (they'd expose the full product a
 * single-module pilot didn't buy). The guard redirects a denied request to `moduleHome(lock)`.
 */
export function isPathAllowed(lock: LockedModule | null, pathname: string): boolean {
  if (!lock) return true;
  return moduleForPath(pathname) === lock;
}

/**
 * The redirect target for a request, or null if it's allowed (no redirect). Encapsulates the guard decision so
 * the caller can do `const to = redirectForLock(lock, pathname); if (to) redirect(to)`. Loop-safe by
 * construction: a module home is always inside its own subtree, so `isPathAllowed(lock, home)` is true — the
 * early null covers the home path, and we only fall through to `moduleHome` for a genuinely disallowed path.
 */
export function redirectForLock(lock: LockedModule | null, pathname: string): string | null {
  return isPathAllowed(lock, pathname) ? null : moduleHome(lock as LockedModule);
}

/** Map a pilot code's `module` value to a lock. 'elostate' (complete) and anything unknown → null (no lock). */
export function lockFromPilotModule(module: string | null | undefined): LockedModule | null {
  return module === "care" || module === "sales_coach" ? module : null;
}

/** A module layout's access decision. `enter` = render the module; `hold` = show an honest in-module
 *  "no access yet" screen; `hub` = redirect to /dashboard. */
export type ModuleGate = "enter" | "hold" | "hub";

/**
 * Decide how a module layout (sales-coach / care) should treat a caller, given whether they're a MEMBER of the
 * module and whether their account is LOCKED to it.
 *
 * The critical rule: a LOCKED non-member must NOT be redirected to the hub. The middleware module-lock (0207)
 * bounces `/dashboard` straight back into the locked module, so a layout that `redirect('/dashboard')`s a locked
 * non-member creates an infinite `ERR_TOO_MANY_REDIRECTS` loop — which bricks a freshly-invited rep in the
 * NORMAL window between invite-accept (role=Member, sales_coach_role=null) and the admin assigning Staff. So a
 * locked non-member `hold`s on an honest terminal INSIDE the module instead. A non-locked non-member is safely
 * sent to the `hub` (no lock, so no bounce, no loop). A member always `enter`s.
 *
 * Pure + tested so re-introducing the loop (redirecting a locked non-member) fails CI, not just review.
 */
export function moduleGateDecision(isMember: boolean, isLocked: boolean): ModuleGate {
  if (isMember) return "enter";
  return isLocked ? "hold" : "hub";
}
