/**
 * Connect-page token-handoff authorization (founder audit 2026-07-23 — connect-page MEDIUM finding).
 *
 * `/extension/connect` hands the logged-in user's session AND long-lived refresh token to a browser
 * extension identified by the URL's `?ext=` param. That param is attacker-controllable, so a lure to
 * `/extension/connect?ext=<malicious-id>` could exfiltrate the token to an attacker's extension. This
 * predicate is the gate: when the official extension id is configured (`allowedExtId`, from
 * `NEXT_PUBLIC_CARE_EXTENSION_ID` — set to the Web Store id in production), ONLY that id is allowed.
 * When it is NOT configured (unpacked local dev has a per-install id that can't be pinned), any
 * non-empty id is allowed and the caller logs the missing pin. An absent/empty id is never allowed.
 *
 * Locked by `extensionHandoff.test.ts` — a regression here reopens a token-theft vector.
 */
export function isExtensionHandoffAllowed(
  ext: string | null | undefined,
  allowedExtId: string
): boolean {
  if (!ext) return false;
  // No official id configured (dev): can't pin — allow, but the caller warns.
  if (!allowedExtId) return true;
  // Official id configured (prod): ONLY the official id may receive the token.
  return ext === allowedExtId;
}
