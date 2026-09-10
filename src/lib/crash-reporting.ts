/**
 * Crash reporting, and the rule that makes it safe here.
 *
 * THIS APP HANDLES RECORDED CUSTOMER CONVERSATIONS. That single fact governs
 * everything below. A crash report is a message sent to a third party, and the
 * things most likely to appear in one — an error string, a URL, a breadcrumb —
 * are exactly the places a transcript, a customer's name or a signed audio link
 * would leak. So this is deliberately narrow: it reports THAT something broke
 * and where in the code, and carries nothing a rep said or a customer answered.
 *
 * MIRRORS THE WEBSITE'S PATTERN, which is already careful: the DSN comes from
 * the environment and, when it is absent, `init` is never called at all. Not a
 * disabled client — no client. That means a build without a DSN reports nothing
 * to anyone, which is the right default for a build that may be sitting on a
 * rep's phone before anyone has decided where its crashes should go.
 *
 * `sendDefaultPii: false` matches the web. It stops the SDK attaching request
 * bodies, headers and user identifiers on its own.
 *
 * WHAT IS SCRUBBED, AND WHY EACH ONE. A signed storage URL grants whoever holds
 * it access to the audio of a real conversation — the app already treats those
 * as secrets and clears them on sign-out, so one must never travel in a crash
 * report. Any JWT-shaped string is treated as a credential; that is broader than
 * naming the keys this app happens to use, and it stays right when the keys
 * change. And any breadcrumb carrying a long free-text blob is far more likely
 * to be a transcript than anything worth debugging.
 *
 * THIS MODULE IMPORTS NOTHING. It was written importing `ENV` so it could
 * compare against the anon key, which made it unloadable in a test — and rules
 * about what may leave the device are exactly the rules that must be testable.
 * Matching the SHAPE of a token rather than one specific value is both safer
 * and pure.
 */
/** Longer than this, in a breadcrumb or an error message, is assumed to be content. */
export const MAX_REPORTED_TEXT = 200;

/** True when a value looks like something that must never leave the device. */
export function isSensitive(value: string): boolean {
  const v = value.toLowerCase();
  return (
    v.includes('token=') ||
    v.includes('access_token') ||
    v.includes('refresh_token') ||
    v.includes('apikey') ||
    v.includes('authorization') ||
    // A Supabase signed-object URL: holding one is holding the recording.
    v.includes('/storage/v1/object/sign') ||
    // Any JWT — the anon key, an access token, a refresh token, or one this
    // app has never heard of. Three dot-separated base64url segments starting
    // with the standard `{"alg"` header prefix.
    /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+/.test(value)
  );
}

/**
 * Make one string safe to send, or drop it.
 *
 * Returns null when the caller should send nothing at all — used rather than an
 * empty string so a scrubbed field is visibly absent rather than blank.
 */
export function scrub(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isSensitive(trimmed)) return '[removed: could identify a conversation]';
  if (trimmed.length > MAX_REPORTED_TEXT) {
    // Long free text in a crash report is far more likely to be a transcript
    // than a useful message. Keep the shape, drop the content.
    return `[trimmed ${trimmed.length} chars]`;
  }
  return trimmed;
}

/** Whether crash reporting should run at all in this build. */
export function reportingEnabled(dsn: string | null | undefined): boolean {
  return typeof dsn === 'string' && dsn.trim().length > 0;
}
