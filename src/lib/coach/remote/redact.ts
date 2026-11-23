/**
 * Number redaction for stored transcripts (decision D15, docs/rss/docs/00-OPEN-DECISIONS.md; Gong F33.3).
 *
 * A run of digits — allowing single spaces, dashes or dots between groups, as a card or account number is read out
 * ("4111 1111 1111 1111", "123-45-6789") — with at least `minDigits` digits is replaced by "[number removed]". Shorter
 * runs (prices, years, "3 bedrooms", times) are left alone. Applied where every transcript line is written
 * (appendTranscriptSegment), so the AI reads, search, exports and the call page never see it.
 *
 * Limits, stated rather than hidden: numbers spoken as WORDS ("four one one one") are not caught; the AUDIO is not
 * altered; lines already stored stay as they are (redaction is for new calls).
 */
import { REDACTION } from "./decisions";

export const REDACTED = "[number removed]";

export function redactNumbers(text: string, minDigits: number): string {
  if (!text || minDigits < 1) return text;
  // Digit groups joined by a single space, dash or dot (no letters in between).
  return text.replace(/\d(?:[ \-.]?\d)*/g, (run) => (run.replace(/\D/g, "").length >= minDigits ? REDACTED : run));
}

/**
 * The text a transcript line is STORED as (D15, decisions.ts REDACTION). Every path that writes transcript text must
 * pass through this: appendTranscriptSegment (live lines), replaceSessionTranscript (uploaded recordings, recovery)
 * and the line-correction route (typed text). Before 2026-11-23 only the first did, so an uploaded call's card number
 * was stored in full. A guard test (transcriptRedactionGate) fails if a writer stops using it.
 */
export function transcriptTextForStorage(text: string): string {
  return REDACTION.enabled ? redactNumbers(text, REDACTION.minDigits) : text;
}
