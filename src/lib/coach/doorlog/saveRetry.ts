/**
 * Door Log save-resilience policy (founder 2026-08-21). Pure decisions, extracted from DoorLog's
 * postDoorLog so the retry/refresh/honest-copy rules are the SINGLE SOURCE and are unit-testable — the
 * orchestration in the component only sequences fetch + refreshSession + backoff around these predicates.
 *
 * Context: the Door Log is online-only (the IndexedDB offline queue is withheld), so a failed write has no
 * durable retry. A rep who has been knocking for hours on solid signal most often fails on an EXPIRED AUTH
 * TOKEN (getUser → null → 401), or a transient 5xx / a momentary network drop — NONE of which are the rep's
 * connection. These predicates encode: which failures are worth retrying, which need a session refresh
 * first, and how to attribute the failure HONESTLY if it ultimately can't save.
 *
 * `status` is the HTTP status of one attempt, or 0 for a fetch that threw (never reached the server).
 */

/**
 * Should a failed attempt with this status be retried at all?
 *  • 0   → the request never reached us (network) — a momentary drop may clear, worth a retry.
 *  • 5xx → a transient server blip — worth a retry.
 *  • 4xx (400 bad body / 403 no company / 401 expired) → deterministic; a plain retry is futile. 401 is
 *    handled separately (refresh THEN retry) — see needsSessionRefresh; it is NOT retryable on its own.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 0 || status >= 500;
}

/** A 401 means the auth token expired/rotated mid field-session — refresh the session before retrying. */
export function needsSessionRefresh(status: number): boolean {
  return status === 401;
}

/**
 * Honest attribution for a save that ultimately failed. Only a request that never reached the server
 * (status 0) may mention the rep's signal; anything the server actually RESPONDED to (401/4xx/5xx) is on
 * our end and must never be blamed on the rep's connection.
 */
export function failReasonFor(status: number): "network" | "server" {
  return status === 0 ? "network" : "server";
}
