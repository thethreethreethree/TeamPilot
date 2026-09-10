/**
 * Does a transcript actually contain SPEECH?
 *
 * The worker has refused to analyze an empty transcript since audit H1 (founder 2026-08-22) — the rubric
 * schema forces a non-empty summary + scores, so analyzing nothing fabricates a "complete" pitch out of
 * silence. That guard is right and it is not enough: STT does not return "" for a silent recording. It
 * returns the sound it heard, annotated — `[clicking]`, `[pause]`, `[outro jingle]`, `[wind blowing]`,
 * `[zipper closing]`. Every one of those is truthy, so `!text.trim()` waves it straight through.
 *
 * Measured 2026-09-10, across ALL companies in the database — the right scope for "does this guard need
 * to exist": 28 of 73 stored pitch transcripts are a single bracketed sound event and NOT ONE word of
 * speech. All 28 were analyzed anyway. 24 came back with every dimension at zero — and those zeros
 * are averaged into Today's Metrics as though a rep had been graded. The other 4 are worse: `[typing]` was
 * scored tone 85 / close 80 / objection 75, a top-quartile door pitch invented from a typing sound.
 *
 * So the check is not "is there text" but "is there anything left once the sound events are removed". An
 * annotation mixed WITH speech ("[background noise] Hi, I'm John from...") is a real pitch and passes.
 *
 * The residual risk is the mirror image: STT bracketing a genuinely spoken word would cost that pitch its
 * analysis. That trade is deliberate — a pitch marked "no speech detected" tells the rep the truth and can
 * be re-run, while a fabricated 85 cannot be told apart from a real one by anyone looking at it.
 */

/** Sound-event annotations: `[clicking]`, `(laughs)`, `*sighs*` — the forms STT uses for non-speech audio. */
const SOUND_EVENT = /\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g;

/**
 * The single error a caller records when a recording carried no words. One string, because the two guard
 * sites in the worker had drifted apart once already and a rep reads whichever one fires.
 */
export const NO_SPEECH_ERROR = "No speech was detected in this recording.";

/** True when at least one spoken word survives stripping every sound-event annotation and punctuation. */
export function transcriptHasSpeech(text: string | null | undefined): boolean {
  if (!text) return false;
  const spoken = text.replace(SOUND_EVENT, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return spoken.length > 0;
}
