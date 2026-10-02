/**
 * What the rep reads when they ask the coach for a cue and it fails (2026-10-02).
 *
 * It said "Cue request failed (502)." and, on a network error, "Cue request failed — see console." Neither
 * means anything to a rep mid-call, and since the AI provider now fails fast during an outage
 * (llm/providerHealth.ts) the rep sees it at once instead of after 45 s. The cue route already sends a
 * sentence we wrote ("Coach couldn't respond right now."), so use it. Still an honest failure, never a false
 * "nothing to add" (the cue route's audit 2026-08-16, #5).
 *
 * `serverError` is the route's own `error` field. Every cue-route error is a fixed sentence of ours (CWE-209
 * holds), so it can be shown; anything that is not a short plain string falls back to our sentence.
 */
export function cueFailureMessage(status: number | null, serverError?: unknown): string {
  if (status === null) return "The coach couldn't be reached. Check your connection and ask again.";
  if (typeof serverError === "string" && serverError.trim() && serverError.length <= 160) {
    return `${serverError.trim()} Ask again in a moment.`;
  }
  return `The coach couldn't respond right now (${status}). Ask again in a moment.`;
}
