/**
 * When the conversation actually happened, as opposed to when the phone got signal.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────────────────────────
 *
 * A session's `started_at` has always been the moment the row was INSERTED. For the web that is the
 * same instant the rep starts talking, so it was never wrong there. For the phone it is not: this
 * app exists for reps working in dead zones, a recording is held on the device until there is a
 * bar, and `POST /api/coach/sales-session` is only reached at upload.
 *
 * So a call recorded on the 4th and uploaded on the 11th became a session dated the 11th. The
 * rep's own history said the conversation happened on a day it did not. Nothing surfaced it while
 * recordings were rarely sent; on 2026-09-11 the app stopped requiring a typed name before a
 * recording could leave the phone, and a backlog of fifteen - the oldest observed run in
 * production was 47 days - was about to arrive dated all on one day.
 *
 * ── WHY THE VALUE IS NOT SIMPLY TRUSTED ─────────────────────────────────────────────────────────
 *
 * It comes from a phone's clock, which can be anything at all. A device set to 2019 would file a
 * conversation in 2019, where no screen would ever show it to anybody again, and a device set
 * ahead would put a call at the top of every list for ever.
 *
 * So it is BOUNDED AND REFUSED rather than clamped, matching `spokenAtFor`'s treatment of an
 * absurd audio offset: a value outside the window returns null and the caller falls back to the
 * server's own clock. Clamping would invent a timestamp, and an invented one is indistinguishable
 * from a real one the moment it is stored.
 */

/**
 * How far back a claimed start is believed.
 *
 * Ninety days, from measurement rather than taste: the longest a real recording has actually sat
 * unsent in this product is 47 days (the sweep's own record, 2026-09-10). Ninety covers that with
 * room and still refuses a clock that is out by years.
 */
export const MAX_BACKDATE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * How far AHEAD a claimed start is believed.
 *
 * Only enough for ordinary clock skew between a phone and this server. A start in the future is
 * the more damaging error of the two - it pins the session to the top of every list ordered by
 * time, where it stays - so the window on this side is deliberately tight.
 */
export const MAX_SKEW_MS = 5 * 60 * 1000;

/**
 * The instant to file a session under, or null to let the database default to now.
 *
 * Null is the ONLY fallback, and it is the behaviour that existed before this function, so an
 * untrusted value costs nothing that was not already being paid.
 */
export function sessionStartedAt(claimed: unknown, now: Date): string | null {
  if (typeof claimed !== "string" || claimed.trim() === "") return null;

  const at = Date.parse(claimed);
  if (!Number.isFinite(at)) return null;

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return null;

  if (at > nowMs + MAX_SKEW_MS) return null;
  if (at < nowMs - MAX_BACKDATE_MS) return null;

  // Normalised, so a session's stored instant does not carry whatever offset the phone happened to
  // express it in. The value is the same moment either way; this only makes the stored form one shape.
  return new Date(at).toISOString();
}
