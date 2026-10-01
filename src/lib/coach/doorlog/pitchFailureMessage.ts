import { NO_SPEECH_ERROR } from "./speechPresence";

/**
 * What a rep may read about a pitch that failed to process. The ONLY way `pitches.error` leaves the server.
 *
 * WHY IT EXISTS (2026-09-30). The worker writes `Processing failed after N attempts: ${message}` into
 * `pitches.error`, where `message` is the raw exception — for the September out-of-credit outage that was
 * `DeepSeek API error 402: {"error":{"message":"Insufficient Balance",...}}`. The report-card route returned
 * the column as-is and `PitchDetail.tsx` rendered it, so a rep read our provider's name and its raw JSON.
 * The CWE-209 invariant did not see it because the text went through the database first.
 *
 * The column stays as it is: it is operations data, and the full detail belongs there and in Sentry. What
 * changes is that the route sends this instead — the worker's own curated sentences pass through, and
 * everything else becomes a sentence we wrote. Unknown text is never passed on (fail closed).
 */
const CURATED_PREFIXES = [
  "No audio was captured for this pitch",
  NO_SPEECH_ERROR,
] as const;

/** The worker's timeout sentence (worker.ts): ours, and safe, but it reads like a log line. */
const TIMEOUT = /^Processing failed after \d+ attempts \(a timeout or crash prevented completion\)\.$/;

/** A billing refusal from the AI provider (LlmError kind "quota"): 402 / insufficient balance / credit. */
const QUOTA = /\b402\b|insufficient[_ ]balance|out of credit|quota/i;

export const PITCH_FAILURE_GENERIC =
  "This pitch couldn't be analyzed. The fault is on our side, not your pitch.";
export const PITCH_FAILURE_AI_UNAVAILABLE =
  "This pitch couldn't be analyzed because our AI service was unavailable at the time. The fault is on our side, not your pitch.";
export const PITCH_FAILURE_TIMEOUT =
  "This pitch took too long to analyze and was stopped. The fault is on our side, not your pitch.";

export function pitchFailureMessage(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  const text = raw.trim();
  if (CURATED_PREFIXES.some((p) => text.startsWith(p))) return text;
  if (TIMEOUT.test(text)) return PITCH_FAILURE_TIMEOUT;
  if (QUOTA.test(text)) return PITCH_FAILURE_AI_UNAVAILABLE;
  return PITCH_FAILURE_GENERIC;
}
