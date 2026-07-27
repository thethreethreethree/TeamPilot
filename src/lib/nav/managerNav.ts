/**
 * filterManagerNav — the shared manager-only nav visibility rule.
 *
 * Both product sidebars (CareShell "C.A.R.E Tools" and SalesCoachShell) hide
 * manager-only destinations (Team, Coach Assessment — server-gated) from non-managers,
 * so a regular user never clicks a nav item that would bounce them (AMD-006 L3 — nav
 * must not stall the user). Defined ONCE here (A13) instead of copy-pasted per shell,
 * and unit-tested so this security-adjacent visibility rule can't silently regress
 * (e.g. an inverted predicate re-exposing manager items to everyone).
 *
 * `isManager` is expected to be `false` while the caller's role is still loading — the
 * safe direction: hide manager-only items until the viewer is confirmed a manager.
 */
export function filterManagerNav<T extends { managerOnly?: boolean }>(
  items: T[],
  isManager: boolean
): T[] {
  return items.filter((item) => !item.managerOnly || isManager);
}
