/**
 * Open-redirect guard for a post-auth `?next=` destination.
 *
 * Honoring a caller-supplied redirect target is a classic open-redirect vector: `?next=https://evil.com` or
 * the protocol-relative `?next=//evil.com` (and the browser-normalized `/\evil.com`) would bounce a freshly
 * authenticated user — with their session live — to an attacker's site. So we accept ONLY a same-origin
 * RELATIVE path: it must start with a single `/` that is NOT followed by another `/` or a `\` (both of which
 * browsers can treat as protocol-relative). Anything else → null (fall back to the default destination).
 *
 * Used by /login to return a user to where they came from — notably the extension connect flow
 * (`/login?next=%2Fextension%2Fconnect`), so a fresh sign-in completes the token handoff instead of
 * dead-ending on the dashboard.
 */
export function safeRelativePath(next: string | null | undefined): string | null {
  if (typeof next !== "string" || next.length === 0) return null;
  // Must be a rooted relative path; reject protocol-relative (`//`, `/\`) and any scheme (`https:`, `javascript:`).
  if (!/^\/(?![/\\])/.test(next)) return null;
  return next;
}
