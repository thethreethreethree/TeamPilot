/**
 * When a LIVE call's line ended (RSS Phase 2 follow-up: interaction stats on live calls use real end times).
 *
 * The realtime speech service (ElevenLabs scribe_v2_realtime, include_timestamps=true) sends, after each committed
 * line, a `committed_transcript_with_timestamps` event whose `words[]` carry `start`/`end` in SECONDS. Its docs do not
 * say what those seconds are measured from, so they are NOT used as clock times. Their span — last word's end minus
 * first word's start — is the measured speaking time whatever the reference point, and the line's start is already
 * measured on the device (spokenAt, the first partial). endedAt = spokenAt + span. Anything unusable → null, and the
 * stats fall back to their estimate for that line, as before. Pure.
 */
type Word = { start?: unknown; end?: unknown; type?: unknown };

const MAX_LINE_SECONDS = 600; // a single committed line longer than 10 minutes is a malformed event, not speech

export function measuredEndedAt(spokenAtIso: string | null | undefined, words: unknown): string | null {
  const t0 = spokenAtIso ? Date.parse(spokenAtIso) : NaN;
  if (!Number.isFinite(t0) || !Array.isArray(words)) return null;
  const spoken = (words as Word[]).filter(
    (w) => w && (w.type === undefined || w.type === "word") && Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)),
  );
  if (spoken.length === 0) return null;
  const first = Math.min(...spoken.map((w) => Number(w.start)));
  const last = Math.max(...spoken.map((w) => Number(w.end)));
  const span = last - first;
  if (!(span > 0) || span > MAX_LINE_SECONDS) return null;
  return new Date(t0 + Math.round(span * 1000)).toISOString();
}
