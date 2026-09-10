/**
 * Does this file actually contain the recording the app thinks it made?
 *
 * THE PRODUCTION FAILURE THIS ENDS, measured 10 September 2026. Of 83 door pitches, 14
 * failed permanently — 17% — and the most telling error reads:
 *
 *     ElevenLabs STT failed: 400 "File is corrupted. Please ensure it is playable audio."
 *     [audio size=5 ct=audio/webm head=1c53bb6b80]
 *
 * FIVE BYTES. And the app had recorded `duration_ms = 129800` for it — the rep stood at a
 * door and recorded for over two minutes. `1C53BB6B` is the Matroska *Cues* element id, so
 * that file is a container fragment with no media in it whatsoever: the recording was
 * finalised while the timer had been running the whole time.
 *
 * WHERE IT WENT WRONG IS NOT WHERE IT WAS NOTICED, and that is the point of this file. The
 * app uploaded it happily. The server accepted it. Five retries later the pipeline gave up,
 * wrote the reason into a `pitches` row, and stopped — somewhere no rep will ever look. The
 * only person who could have done anything about it was the rep, at the door, in the ten
 * seconds after they stopped recording, and they were the one person never told.
 *
 * So the question is asked at the moment it can still be answered.
 *
 * THE THRESHOLDS ARE MEASURED, NOT GUESSED. Real recordings from this company's own
 * storage, bytes divided by their true duration:
 *
 *     42,975,676 B / 2,560 s  =  16,787 B/s   (a 42-minute call)
 *        619,620 B /   149 s  =   4,158 B/s   (the founder's 149-second test)
 *         62,019 B /     7 s  =   8,860 B/s   (a 7-second clip)
 *
 * The lowest real value measured is ~4,100 B/s. The floor here is 200 B/s — twenty times
 * below that, and far below what any voice codec produces even encoding near-silence, so a
 * genuinely quiet room still passes. The failure it catches sat at 0.00004 B/s.
 *
 * IT IS DELIBERATELY NOT A SILENCE DETECTOR. Whether anybody spoke is a question about
 * audio content, and answering it here would need decoding the file and would start
 * throwing away recordings of quiet conversations. This only answers the much narrower
 * question the byte count can actually settle: is there any media in this container at all.
 */

/** Below this, no container holds usable audio — it is header bytes and nothing else. */
export const MIN_RECORDING_BYTES = 1024;

/**
 * Bytes per second of claimed duration, below which the file cannot hold what the timer
 * says it does. Twenty times under the lowest real recording measured on this account.
 */
export const MIN_BYTES_PER_SECOND = 200;

export type RecordingIntegrity =
  | { ok: true }
  | {
      ok: false;
      /**
       * `empty` — the file is too small to be a recording at all.
       * `too-small-for-its-length` — there are bytes, but nowhere near enough for the
       * duration the recorder reported, so the capture was cut short or never started.
       */
      reason: 'empty' | 'too-small-for-its-length';
      sizeBytes: number;
      durationMs: number | null;
    };

/**
 * Judge a finished recording by its size against its own reported length.
 *
 * UNKNOWN IS NEVER A FAILURE. A missing or nonsensical size or duration means the app does
 * not know, and refusing to send on "do not know" would throw away a rep's real call to
 * protect against a maybe. Only a size the app HAS and that is unambiguously too small
 * fails.
 */
export function checkRecordingIntegrity(
  sizeBytes: number | null | undefined,
  durationMs: number | null | undefined,
): RecordingIntegrity {
  // No size reading at all — not a verdict this function is entitled to give.
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return { ok: true };
  }

  const duration =
    typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0
      ? durationMs
      : null;

  if (sizeBytes < MIN_RECORDING_BYTES) {
    return { ok: false, reason: 'empty', sizeBytes, durationMs: duration };
  }

  /*
   * NO SHORT-CLIP EXEMPTION, and the absence is deliberate rather than an oversight.
   *
   * This carried a `duration > 3000ms` guard, on the reasoning that container overhead
   * dominates a very short clip and makes a bytes-per-second reading meaningless. A
   * mutation test survived it - no input could tell the two versions apart - and the
   * arithmetic says why: passing the floor above means at least 1,024 bytes, so a clip of
   * three seconds already reads at 341 B/s, well clear of the 200 B/s floor. The rate check
   * cannot fire below about 5.1 seconds no matter what. The guard never changed an outcome.
   *
   * It is removed rather than kept as reassurance, because a condition that cannot fire
   * still tells the next reader that a case was handled when nothing handles it.
   */
  if (duration !== null) {
    const perSecond = sizeBytes / (duration / 1000);
    if (perSecond < MIN_BYTES_PER_SECOND) {
      return { ok: false, reason: 'too-small-for-its-length', sizeBytes, durationMs: duration };
    }
  }

  return { ok: true };
}

/**
 * What the rep is told, in their own terms.
 *
 * NOT AN ERROR CODE AND NOT A BLAME. The rep did nothing wrong — they recorded, and the
 * phone handed back an empty file. So it says what happened, that nothing else about the
 * knock is lost, and the one thing that helps: record it again if they still can.
 */
export function integrityMessage(reason: 'empty' | 'too-small-for-its-length'): string {
  return reason === 'empty'
    ? 'This recording came back empty — the phone saved the file but there is no audio in it, so there is nothing to transcribe. Everything else about this door is saved. If you are still there, record it again.'
    : 'This recording is far too small for how long it ran, which means the audio stopped being captured partway. There is nothing usable to transcribe. Everything else about this door is saved — if you are still there, record it again.';
}
