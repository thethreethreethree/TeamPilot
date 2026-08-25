# BUILD — empty/unplayable recording → honest "No audio captured", not a relayed "corrupted"

### the playable-container guard at the STT chokepoint
- write-path: `worker.ts` — after the existing `dl.bytes.length === 0` guard, add:
  `if (!startsWithNewRecordingHeader(dl.bytes)) { log describeAudioBytes signature; setPitchStatus failed "No audio
  was captured (empty or unplayable)"; return; }`. Imports `startsWithNewRecordingHeader` from the shared stitch module.
- read-path: a non-empty but headerless recording (the observed 5-byte webm Cues stub, `head 1c53bb6b`) now
  terminates as an honest "No audio captured (empty or unplayable)" and is NEVER sent to STT — instead of the
  misleading "invalid_audio / corrupted" the rep saw before. A valid-header recording is unaffected (passes the
  guard, proceeds to STT exactly as before).

### the test-mock correction the guard forces
- write-path: `worker.test.ts` — the default `downloadAssetBytes` mock returned a headerless `Buffer.from("x")`;
  changed to a valid EBML-header buffer so the existing STT-path tests still reach STT (the new guard would
  otherwise short-circuit them). Added a case: a 5-byte Cues-stub recording → honest terminal, STT not called.
- read-path: the suite proves both — a valid recording still transcribes; an unplayable stub fails honestly without
  an STT call.

## Files
- `src/lib/coach/doorlog/worker.ts` — import `startsWithNewRecordingHeader`; add the playable-container guard.
- `src/lib/coach/doorlog/__tests__/worker.test.ts` — valid-header default mock; +1 headerless-stub test.
- Investigation/ops scripts (data-as-asset — the ground-truth work that corrected the diagnosis): `diag-corrupted-
  audio-pitches.mjs`, `diag-inspect-pitch-audio.mjs`, `diag-pitch-audio-forensic.mjs`, `diag-doorlog-capture-events.mjs`,
  `diag-pitch-status-window.mjs`, `requeue-corrupted-audio-pitches.mjs`, `revert-empty-pitch-requeue.mjs` (all READ-ONLY
  except the two re-queue/revert tools, which dry-run by default).

## A26 boundary (class swept)
`transcribeSpeech` consumers: pitch `worker.ts` (fixed), `care/stt/route.ts` (already catches STT failure → graceful
customer retry → out of the harm-class; flagged, not built — A24), `elevenlabs.ts` (impl). Boundary = the pitch worker.

## Ripple (holistic — §6 item 5)
- Guard at the existing chokepoint; no schema/route/API/migration/external-config change.
- Only touches a recording that would have failed at STT anyway; a valid recording is unaffected.
- Complements, does not overlap, the b5cdb61d recovery (which fires on VALID-header STT rejections).

## Honest limit
This makes the failure HONEST; it does not RECOVER the audio (there is nothing to recover — the capture was empty).
The real reliability lever is WHY the client captures empty recordings — investigated separately (report to follow),
not assumed here. Also flagged: the seq-0 chunk-loss class (whole-recording loss) and the missing brain-config
class — distinct from this fix.
