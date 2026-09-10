/**
 * When each turn of an UPLOADED recording was spoken.
 *
 * THE BUG THIS CLOSES. The pace ("speed") skill reads `coaching_transcript_
 * segments.spoken_at` and needs at least three timed agent turns; without them
 * it reports "not enough sessions yet" forever. Live sessions stamp `spokenAt`
 * from the browser as each utterance is captured. An UPLOADED recording never
 * did — so every uploaded call, from the web AND from the native app, has had a
 * permanently blank pace skill.
 *
 * The timing was never missing. `transcribeWithDiarization` already computes a
 * per-segment `start` (seconds into the audio) from the provider's per-word
 * timestamps; `buildSpeakerResponse` dropped it on the way back to the client,
 * and `label-transcript` had nowhere to put it. It is carried now.
 *
 * WHAT THE BASE IS, AND WHY IT DOES NOT HAVE TO BE PERFECT. The offsets are
 * relative to the start of the audio, and `spoken_at` is a wall clock, so the
 * two are joined at the session's own `created_at`. `agentWpm` measures each
 * turn as the GAP TO THE NEXT timed segment, so a base that is a few seconds
 * early or late shifts every stamp equally and changes no gap and no score. The
 * base only has to be honest enough for the clock shown beside a transcript
 * line, which is what the session's creation time is.
 *
 * PURE, because "a day's worth of seconds arrived and we wrote a timestamp
 * tomorrow" is exactly the kind of thing that is invisible until a rep's pace
 * is scored against a turn that appears to last eleven hours.
 */

/** A recording longer than this is a glitched offset, not a sales call. */
export const MAX_OFFSET_SECONDS = 24 * 60 * 60;

/**
 * The wall-clock time a segment was spoken, or null when it cannot be known.
 *
 * NULL RATHER THAN THE BASE. A segment whose offset is missing must not be
 * stamped with the start of the call: `agentWpm` would then measure the next
 * turn's gap from a time it was not spoken at, and a wrong number is worse here
 * than no number — the whole point of the skill is that it is measured.
 */
export function spokenAtFor(
  baseIso: string | null | undefined,
  startSeconds: number | null | undefined,
): string | null {
  if (!baseIso) return null;
  const baseMs = Date.parse(baseIso);
  if (!Number.isFinite(baseMs)) return null;
  if (typeof startSeconds !== "number" || !Number.isFinite(startSeconds)) return null;
  // Negative is not "slightly before the start", it is a corrupt offset.
  if (startSeconds < 0 || startSeconds > MAX_OFFSET_SECONDS) return null;
  return new Date(baseMs + Math.round(startSeconds * 1000)).toISOString();
}
