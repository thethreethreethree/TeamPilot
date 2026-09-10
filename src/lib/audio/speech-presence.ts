/**
 * Does a transcript line contain SPEECH?
 *
 * Speech-to-text does not return an empty string for a recording with nobody talking in it. It returns
 * the sound it heard, annotated: `[clicking]`, `[pause]`, `[outro jingle]`, `[wind blowing]`. Every one of
 * those is a non-empty string, so every `.trim().length > 0` check waves it straight through.
 *
 * Measured against production on 2026-09-10: 28 of 73 stored door-pitch transcripts are a single bracketed
 * sound event and not one word of speech. All 28 were graded anyway — 24 scored zero on every dimension,
 * and `[typing]` was scored tone 85.
 *
 * This is the app's copy of the web repository's `src/lib/coach/doorlog/speechPresence.ts`. The two cannot
 * import from each other, so they are kept honest by their tests: both pin the SAME verbatim production
 * strings, so a change to one that the other does not follow shows up as a failure rather than as drift.
 */

/** Sound-event annotations: `[clicking]`, `(laughs)`, `*sighs*` — the forms STT uses for non-speech audio. */
const SOUND_EVENT = /\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g;

/** True when at least one spoken word survives stripping every sound-event annotation and punctuation. */
export function hasSpeech(text: string | null | undefined): boolean {
  if (!text) return false;
  return (
    text
      .replace(SOUND_EVENT, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim().length > 0
  );
}
