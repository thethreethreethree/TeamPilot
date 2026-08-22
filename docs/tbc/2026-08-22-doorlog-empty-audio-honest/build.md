# BUILD — Empty/silent pitch audio fails honestly (audit H1)

### worker empty-audio guards
- write-path: `processPitch` (`worker.ts`) — (1) after download, `!dl.bytes || dl.bytes.length === 0` → terminal
  `failed` "No audio was captured"; (2) after `transcribeSpeech`, `!text.trim()` → terminal `failed` "No speech
  was detected" BEFORE writing the transcript or analyzing; (3) before `analyzePitch`, an empty read-back
  transcript → terminal `failed` (defense-in-depth for an already-persisted empty transcript).
- read-path: the Report Card shows a `failed` pitch as "processing failed" — distinct from an empty history and
  from a real analyzed pitch; no hollow "complete" card with made-up scores is ever produced.

## Files
- `src/lib/coach/doorlog/worker.ts` — the three guards.
- `src/lib/coach/doorlog/__tests__/worker.test.ts` — +3 tests: empty STT → failed (never analyzed/written);
  0-byte download → failed (never sent to STT); pre-persisted empty transcript → failed.

## Reuse
No new surface — tightens the existing status machine (`setPitchStatus("failed", …)`) at the transcription
boundary. No client/route/schema change.
