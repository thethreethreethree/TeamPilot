# CLOSURE — close the empty-capture detection hole

## What shipped
The DoorLog save gate now decides "has audio" by VIABILITY (durable chunks OR a blob large enough to hold media),
not blob existence — so a truthy-but-empty iOS stub no longer becomes a doomed pitch. A non-viable capture warns the
rep (audioDropped) and records the CaptureDiag (with the new `capturedBytes` signal) so the device cause is on the
record. Pure `isCaptureViable` + `MIN_VIABLE_AUDIO_BYTES` in the shared captureDiag module.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Targeted: captureDiag + all 12 DoorLog render suites green.

## The un-named reliance
- **A real recording is ≥ ~1KB even for a fraction of a second.** Opus in a webm/mp4 container carries the header +
  audio frames; a capture below MIN_VIABLE_AUDIO_BYTES produced only container overhead (no media). Relied upon so
  the threshold never rejects a legitimate short pitch; pinned by the "blob ≥ threshold → viable" test and the
  realistic-mock DoorLog suites. If a real short pitch ever fell below it, the founder's device validation catches it.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "MIN_VIABLE_AUDIO_BYTES = 1024 is a heuristic threshold, not derived per-codec/bitrate.",
    "why_skipped": "Grounded in the observed data (stubs are 5 bytes; the smallest real single-blob pitch is KB-scale) with wide margin, and it only gates the single-blob fallback (chunked captures bypass it entirely). A per-codec derivation adds complexity for no observed benefit. Chunks-uploaded is the primary viability signal; the blob-size floor is the fallback-only backstop.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-25T11:25:00+08:00",
    "outcome": "OPENED + confirmed: the threshold only ever decides the single-blob fallback path (chunksUploaded===0). Every chunked capture is viable via chunks regardless of the number. So the only risk is a real single-blob recording under 1KB — physically impossible for a webm/mp4 with any audio frames (header alone approaches that; add any opus and it clears it). Margin is ample; no change. The founder's device validation is the live backstop."
  },
  {
    "id": "R2",
    "item": "The iOS ROOT cause (why the capture is empty) is not fixed — this only warns + records.",
    "why_skipped": "Needs a real iOS device to test the AudioContext/MediaRecorder race + why chunks don't upload on iOS; that is the founder-gated next step, now UNBLOCKED because this build records capturedBytes + emits the diag for the previously-silent stub cases. Diagnose from that data, not assumption.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```
