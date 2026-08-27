# CLOSURE — coaching stitch content-type fix

## What shipped
A proactive audit of the DoorLog iOS fix's neighbors found its coaching twin had drifted: `stitchPitchAudio` (DoorLog)
was fixed 2026-08-23 to preserve the chunk's real content-type on the stitched recording, but `stitchSessionAudio`
(live + meeting) still hardcoded `contentType: "audio/webm"`. The two stitchers share their concatenation helpers but
the content-type DECISION was duplicated, so one copy got the fix and the other did not (the §2.2 duplicated-condition
drift). An iOS live/meeting session that reached the STITCH path (drop / phone-lock / never-Stop) therefore had its
mp4 recording stored + handed to STT labeled webm. Fix: preserve the first chunk's real content-type on the stitched
upload, mirroring the proven twin. Clean-Stop persist (already correct) untouched.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Two new gate tests lock the label on the coaching stitch (mp4 preserved,
webm default kept); the DoorLog twin was already covered. Typecheck clean; 588 files / 3847 tests.

## The un-named reliance
- **The mock proves the label, not the STT round-trip.** jsdom/mock can't prove ElevenLabs accepts the relabeled iOS
  mp4 end-to-end — that rests on the same live-iPhone confirmation the DoorLog fix awaits (`diag-capture-live.mjs` + a
  real session). What silently broke this — the drifted label — is now locked on both twins.
- **An intermittent test flake** appeared on one full-gate run and did not reproduce across two subsequent clean runs.
  It is unrelated to this deterministic change (the change touches only a contentType string), but it is a real
  timing-sensitive test somewhere worth watching if it recurs — not chased now (no repro, no signal to instrument).

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The coaching chunk PATHS + stitched-file KEY are hardcoded `.webm`-suffixed (stitchSessionAudio.ts:25-28) even for iOS mp4. Cosmetic only — the key is an opaque storage path; STT uses the stored contentType (now correct), not the extension.",
    "why_skipped": "No functional impact (verified: STT reads dl.contentType, not the key's suffix; the DoorLog twin has the identical `.webm` key and transcribes mp4 fine). Renaming the key would be churn with migration risk on existing pointers.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T09:26:00+08:00",
    "outcome": "OPENED + bounded: label is truthful; the opaque key suffix is left as-is deliberately."
  }
]
```
