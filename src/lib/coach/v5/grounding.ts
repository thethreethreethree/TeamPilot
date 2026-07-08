/**
 * §3.4 quote grounding — shared by the post-call engines (moments, pivot, score).
 *
 * The prompts require every verbatim quote (customerLine / repLine / a score's
 * citation) to actually appear in the transcript. The parsers previously grounded
 * only the moment's `atSeq` against a real segment, but took the QUOTE STRING from
 * the model verbatim — so a real timestamp could carry an invented "customer's
 * words", surfaced to a manager as a verbatim, timestamped statement. That is the
 * exact fabrication §3.4 forbids and the sibling `groundCompetitors` prevents.
 *
 * This grounds by WORDS, not punctuation: an LLM commonly re-punctuates or restyles
 * quotes (smart quotes, trailing "…", capitalisation) while keeping the words, so we
 * normalise both sides to lowercase alphanumeric-and-spaces and require the quote's
 * words to appear as a contiguous run in the transcript. A quote whose WORDS aren't
 * in the transcript is dropped (returned null) — the moment/score still stands on its
 * grounded `atSeq`/number; only the unverifiable verbatim string is removed.
 *
 * Pure + dependency-free so it is a tested unit.
 */

/** Lowercase, strip to alphanumeric + single spaces. Punctuation/quotes/ellipsis
 *  differences vanish; the actual words remain. */
function normalizeWords(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Return `quote` unchanged iff its words appear (contiguously, case/punctuation-
 * insensitive) in the transcript; otherwise null. Quotes shorter than MIN_WORDS
 * grounding chars are too weak to match safely (a 2-word fragment matches almost
 * anything) and are dropped defensively.
 */
export function groundQuote(
  quote: string | null | undefined,
  segments: ReadonlyArray<{ text?: string | null }>
): string | null {
  if (typeof quote !== "string") return null;
  const original = quote.trim();
  if (!original) return null;
  const core = normalizeWords(original);
  // Require a minimum of real signal: at least ~8 chars of words. A shorter
  // "quote" can't be reliably distinguished from a coincidental match.
  if (core.length < 8) return null;
  const haystack = normalizeWords(
    segments.map((s) => s?.text ?? "").join(" \n ")
  );
  return haystack.includes(core) ? original : null;
}
