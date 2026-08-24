# BUILD — ElevenLabs "invalid_audio / corrupted": mp4-aware reseam + ground-truth capture

### the recorder-recreation reseam is container-aware (webm AND mp4)
- write-path: `stitchSessionAudio.ts` — new `startsWithMp4InitSegment` (an `ftyp` box, type bytes at offset 4) +
  `startsWithNewRecordingHeader` = EBML OR mp4-ftyp. Both stitch reseams now use it: `stitchSessionAudio.ts` (live
  / meeting) and `pitchAudioChunks.ts` (Door Log pitch) — `if (i>0 && startsWithNewRecordingHeader(bytes)) break`.
- read-path: an iOS recording (audio/mp4) that spans a recorder recreation now STOPS at the second init segment
  and keeps segment 1 — a playable, transcribable file — instead of concatenating two `ftyp` inits into a file
  ElevenLabs rejects as "corrupted." A continuation fragment (`moof`, not `ftyp`) never false-triggers the seam.

### an STT rejection captures the audio's ground truth (instrument, don't assume)
- write-path: `worker.ts` wraps `transcribeSpeech`; on throw it logs + appends `describeAudioBytes(bytes, ct)` —
  size, content-type, first-16-bytes magic, and a mid-file second-init offset (the bad-concat fingerprint) — then
  re-throws (retry/terminal machinery unchanged). `describeAudioBytes`/`findSecondInitSegment` live in
  `stitchSessionAudio.ts` (pure, reused).
- read-path: the next "corrupted" failure's terminal error + Sentry NAME the cause as data (bad concat vs wrong
  format vs truncation), so the fix is confirmed from evidence — not assumed.

## Files
- `src/lib/coach/v5/stitchSessionAudio.ts` — +`startsWithMp4InitSegment`, +`startsWithNewRecordingHeader`,
  +`findSecondInitSegment`, +`describeAudioBytes`; reseam widened.
- `src/lib/coach/doorlog/pitchAudioChunks.ts` — import + reseam use the container-aware helper (doc comment synced).
- `src/lib/coach/doorlog/worker.ts` — STT-failure ground-truth capture.
- tests: `stitchSessionAudio.test.ts` (+6: mp4 detector / new-recording-header / findSecondInit / describeAudioBytes /
  mp4 reseam-stops); pitch + worker tests re-run unbroken.

## A26 boundary (class swept)
Class = "recorder-recreation reseam that only recognises ONE container." Both instances of `startsWithEbmlHeader`
in a reseam (`stitchSessionAudio.ts:96`, `pitchAudioChunks.ts:90`) now use the container-aware helper. The client
reference in `useLiveCoaching.ts:1210` is a comment/blob-fallback, not a server stitch — out of the reseam class.

## Ripple (holistic — §6 item 5)
- Pure helpers + one added stop condition; no schema/route/API change, no migration, no external config.
- webm recordings unaffected (mp4 check can't match EBML); the diagnostic runs only on the failure path.
- Both stitch paths import ONE shared helper — the reseam semantics can't drift between pitch and live/meeting.

## Honest limit
The mp4-reseam addresses the STRONGEST hypothesis for this specific failure (iOS + recreation), but the failing
pitch's actual audio wasn't inspectable headlessly. The ground-truth capture is what CONFIRMS it (or points
elsewhere) on the next occurrence — this build ships the fix AND the instrument that proves it.
