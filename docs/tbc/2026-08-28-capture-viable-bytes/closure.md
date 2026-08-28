# CLOSURE — capture viability on byte volume (24% pitch-failure symptom fix)

## What shipped
`isCaptureViable` now gates on BYTE VOLUME (`capturedBytes`, the diag's real "was there audio" signal), not chunk
COUNT. A proactive audit found ~24% of door pitches failing (5-byte iOS stubs that streamed "1 chunk" passed the
old gate → became pitches → died at STT "corrupted"). The founder approved the fix. Now a stub is correctly
rejected: the rep gets an honest "capture failed, re-record" and the outcome is still logged as a knock, instead
of a silently-doomed pitch polluting the pitch list + door KPIs. Real recordings (KB+) are unaffected.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The gate + the capturedBytes plumbing are unit-gated (+3 cases) and
typechecked; DoorLog is the only caller (blast radius verified). The live per-device effect is founder visual-verify.

## The un-named reliance
- **Root cause NOT fixed** — this stops the doomed-pitch symptom, not the stub production. A rep on the affected
  path still can't capture until the format root cause is addressed (R1). The fix makes that visible (honest
  re-record) rather than hidden (a later "corrupted" failure).
- **Live-device effect is founder visual-verify** — jsdom can't reproduce an iOS MediaRecorder stub; the gate logic
  is unit-tested and the signal is the one the diag already tracks.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "ROOT CAUSE (critical): iOS is producing 5-byte webm stubs in the first place — the failures are .webm despite a DoorLog comment saying 'iOS records mp4', so the webm-vs-mp4 format selection may not be taking effect on the affected devices/versions. Until fixed, affected reps CANNOT capture a pitch (they now get an honest re-record loop instead of a doomed pitch). Needs a focused capture-format investigation (MediaRecorder mimeType selection on iOS; possibly force mp4 / audio/mp4 when iOS is detected).",
    "why_skipped": "The founder approved the isCaptureViable gate fix (the symptom). The stub-production root cause is a separate, larger capture-pipeline investigation.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T13:55:00+08:00",
    "outcome": "OPEN — investigate why iOS records a stub (format selection); this is the fix that actually lets affected reps capture again."
  },
  {
    "id": "R2",
    "item": "The historical 11 failed pitches (this week) stay failed — this fix is forward-only (prevents NEW stubs from becoming pitches). Those reps' pitches are unrecoverable (the audio was never real).",
    "why_skipped": "No real audio exists to recover; the fix prevents recurrence.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-28T13:55:00+08:00",
    "outcome": "OPEN — nothing to recover; informational."
  }
]
```
