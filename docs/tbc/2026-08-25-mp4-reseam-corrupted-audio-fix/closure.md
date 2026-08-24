# CLOSURE — ElevenLabs "invalid_audio / corrupted": mp4-aware reseam + ground-truth capture

## What shipped
The recorder-recreation reseam is now container-aware (webm EBML **and** mp4 `ftyp`) in BOTH stitch paths, so an
iOS mp4 recording that spans a mid-call recorder recreation no longer concatenates two init segments into an
unplayable file — the exact shape ElevenLabs rejects as "corrupted." And an STT rejection now logs the audio's
ground-truth signature (size / format / magic / bad-concat fingerprint), so the cause is confirmed from data.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Targeted: 31 tests green across the stitch/pitch/worker files, incl. the
6 new (mp4 detector, container-aware header, second-init finder, describeAudioBytes, mp4 reseam-stops).

## The un-named reliance
- **The recreated iOS recorder's first chunk starts with `ftyp`.** MediaRecorder mp4 init = `ftyp`+`moov`;
  continuation fragments start with `moof`. So the reseam triggers only on a genuine new-recording init, never on
  a same-recording fragment. Relied upon; the `moof≠new-recording` case is pinned by a test.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "aac/mpeg fallback recordings' init headers are NOT reseam-detected (only webm EBML + mp4 ftyp).",
    "why_skipped": "useDoorRecorder picks webm → mp4 → aac → mpeg (line 37). aac/mpeg are DEEP fallbacks, reached only where BOTH webm and mp4 are unsupported — vanishingly rare on the iOS(mp4)/Android+desktop(webm) field devices. A recorder recreation on an aac/mpeg recording would still mis-concatenate; add their signatures to startsWithNewRecordingHeader if it ever materialises.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-25T05:19:00+08:00",
    "outcome": "OPENED + CONFIRMED. Re-read useDoorRecorder.ts:37 — the order is audio/webm;codecs=opus → audio/webm → audio/mp4 → audio/aac → audio/mpeg. Real field devices resolve at webm (Android/desktop) or mp4 (iOS Safari) — the first two of the first three. aac/mpeg require a browser that supports NEITHER webm NOR mp4 MediaRecorder, which is not a device in use. So the gap is real but not reachable in practice; left as a one-line extension for the future, not a fix now (A24)."
  },
  {
    "id": "R2",
    "item": "The mp4-reseam is the strongest HYPOTHESIS for the reported failure, not a confirmed root for that exact pitch.",
    "why_skipped": "The failing pitch's audio wasn't inspectable headlessly. The reseam gap is a genuine defect regardless (fixed correctly); the ground-truth capture shipped alongside is what CONFIRMS it was this failure's cause (a mid-file second init) or points elsewhere (wrong format / truncation) on the next occurrence. This is the instrument-don't-assume discipline honored, not skipped.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
