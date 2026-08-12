# BUILD — recovery message honesty

## Feature inventory
### Zero-segment transcription message no longer misattributes a service failure to the recording
- write-path: none (client copy). N/A.
- read-path: `SessionRecordingUpload.applyTranscribeResponse` — on a 200 with zero segments, the thrown message
  (shown to the rep in the error line) now reads honestly for both a genuinely-silent upload AND a service miss on
  good audio, and never asserts "your recording was empty". Reachable from both entry points that share the
  handler: the fresh-upload path (`uploadBlob`) and the recover-from-saved path (`retranscribe`, incl. the
  After-Pitch auto-recover). Verified by reading both paths; no behaviour/backend change to test.

## Files changed
- src/components/sales-coach/SessionRecordingUpload.tsx — reword the zero-segment `throw` message (copy only).

## Holistic (§1.5.1)
Pure copy. Aligns the outlier message to the founder-approved After-Pitch "didn't connect / audio saved" framing
next to it. No logic, schema, or route change. One-line revert if the founder words it differently.
