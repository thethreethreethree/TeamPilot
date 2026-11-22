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
export const REDACTED = "[number removed]";

export function redactNumbers(text: string, minDigits: number): string {
  if (!text || minDigits < 1) return text;
  // Digit groups joined by a single space, dash or dot (no letters in between).
  return text.replace(/\d(?:[ \-.]?\d)*/g, (run) => (run.replace(/\D/g, "").length >= minDigits ? REDACTED : run));
}
