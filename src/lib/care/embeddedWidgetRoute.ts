/**
 * True for the customer-facing embedded Care widget routes (`/widget/*`).
 *
 * The embedded widget renders on a third party's own site inside an iframe. ELOSTATE's global chrome
 * — the floating Feedback button and the Jeff CareChatWidget FAB — must NEVER render there; they can't
 * escape the root layout, so each hide-check must exclude these routes explicitly (audit V5 2026-07-22).
 *
 * Exact-segment match (`=== "/widget"` or a `"/widget/"` prefix) — NOT a bare `startsWith("/widget")`,
 * which would also wrongly match an unrelated route like `/widgets`.
 */
export function isEmbeddedWidgetRoute(
  pathname: string | null | undefined
): boolean {
  return !!pathname && (pathname === "/widget" || pathname.startsWith("/widget/"));
}
