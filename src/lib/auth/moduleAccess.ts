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

const SALES_COACH_ROOT = "/dashboard/sales-coach";
const CARE_ROOT = "/dashboard/care";

/**
 * The module a path belongs to. A path is a module's iff it IS the module root or sits under it (`root/`), so
 * `/dashboard/sales-coach-x` is NOT mistaken for the sales-coach subtree. Everything else is the elostate hub.
 */
export function moduleForPath(pathname: string): PathModule {
  if (pathname === SALES_COACH_ROOT || pathname.startsWith(SALES_COACH_ROOT + "/")) return "sales_coach";
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
 * the layout can call one function: `const to = redirectForLock(lock, pathname); if (to) redirect(to);`.
 * Never redirects a path that's already the account's module home (avoids a redirect loop).
 */
export function redirectForLock(lock: LockedModule | null, pathname: string): string | null {
  if (isPathAllowed(lock, pathname)) return null;
  const home = moduleHome(lock as LockedModule);
  return pathname === home ? null : home;
}

/** Map a pilot code's `module` value to a lock. 'elostate' (complete) and anything unknown → null (no lock). */
export function lockFromPilotModule(module: string | null | undefined): LockedModule | null {
  return module === "care" || module === "sales_coach" ? module : null;
}
