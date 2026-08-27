# BUILD — coaching stitch preserves the chunk's real content-type

### Preserve the real container on the stitched coaching recording
- write-path: `stitchSessionAudio.ts` — capture the first readable chunk's `dl.contentType` into `chunkContentType`
  (default `audio/webm`), and upload the stitched `recording.webm` with `contentType: chunkContentType` instead of the
  hardcoded `"audio/webm"`. Mirrors the DoorLog twin `stitchPitchAudio` (fixed 2026-08-23).
- read-path: `downloadAssetBytes` reads the true type back; the meeting dissect route + live worker hand STT the
  correct container for an iOS mp4 recording that reached the stitch (drop/phone-lock durability path).

### Gate the lesson on BOTH twins (A30 / §2.2)
- write-path: `stitchSessionAudio.test.ts` — the mock now models chunk contentType (`downloadAssetBytes` returns it)
  and captures the upload's contentType. Two tests: an mp4-chunk stitch stamps `audio/mp4`; a webm-chunk stitch stays
  `audio/webm`.
- read-path: a regression back to a hardcoded label fails the mp4 test. (The DoorLog twin was already covered.)

## Files
- `src/lib/coach/v5/stitchSessionAudio.ts` — preserve chunk contentType on the stitched upload.
- `src/lib/coach/v5/__tests__/stitchSessionAudio.test.ts` — content-type mock + 2 gate tests.

## Ripple (§6 item 5)
No schema/API/route change. The chunk route already stored the real type; only the stitch's OVERRIDE changed. The
clean-Stop `persistRecording` path (already correct) is untouched. The storage KEY stays `.webm`-suffixed (opaque
path, format-independent) — only the stored contentType is now truthful. Consumers (dissect, worker) already read
`dl.contentType`, so they benefit with no change.

## Honest limit
The mock proves the LABEL is preserved; it can't prove ElevenLabs accepts the relabeled iOS mp4 end-to-end — that
rests on the same live-iOS confirmation as the DoorLog fix (`diag-capture-live.mjs` + a real iPhone session). The
drifted decision (which is what silently broke it) is now locked on both twins.
