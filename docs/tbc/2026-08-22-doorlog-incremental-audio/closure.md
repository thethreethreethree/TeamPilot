# CLOSURE — DoorLog incremental (chunked) audio upload + wake lock

## What shipped
The REAL fix for "the recording didn't save on a long call" / "it was recording then it stopped." DoorLog now
uploads the recording in ~15s chunks DURING recording (reusing the live-coaching path), holds a screen wake lock
so the phone doesn't lock/dim and kill the mic track, and the server stitches the chunks. Additive: the
disposition-save and the single-blob upload (now a fallback) are untouched; a recording that stopped early but
streamed chunks is saved, not dropped. No schema/migration change. Full `npm run check` exit 0.

This corrects an earlier over-claim: 506a93d0 fixed the OUTCOME loss, not the RECORDING loss. Cause proven from
the live DB before building (the only 2 audio-less pitches in 48h were 5.6 min and 21 min).

## The un-named reliance
- **On-device verification is REQUIRED before this is "proven" (founder's explicit gate).** Automated tests
  prove the wiring; they cannot prove a real recording surviving a throttled connection or the wake lock.
  **Founder device test:** (1) record a 6-10 min pitch on a phone; watch it save with audio in Pitch Performance.
  (2) During a long recording, lock/background the phone for ~30s, return, Stop — confirm the pre-lock audio
  saved (chunks) rather than nothing. (3) On a deliberately weak/throttled connection, record 8+ min — confirm
  the recording persists (chunks) instead of the "didn't save" failure. Report back what you see.
- **Stale clients** still lag a deploy (the actively-knocking rep who never idles); the VersionWatcher updates
  them on pause/reopen. This fix reaches them once their client updates. (Separate concern, flagged.)

## Residual (A36)

```json
[
  {
    "id": "empty-transcript-fabricated-complete-not-fixed-here",
    "item": "The audit's H1 (empty/silent/0-byte audio → fabricated 'complete' analysis) is NOT addressed in this build.",
    "why_skipped": "This build fixes the recording-LOSS cause the founder reported; H1 (a captured-but-silent recording mislabeled complete) is a distinct honesty defect already written up in docs/RELIABILITY-AUDIT-2026-08-22.md for a separate, founder-directed pass.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T07:24:00+08:00",
    "outcome": "Deferred to the reliability-audit follow-ups; not in scope for the recording-loss fix."
  },
  {
    "id": "wake-lock-battery-tradeoff",
    "item": "Holding a screen wake lock while recording keeps the screen on, which uses more battery during a long pitch.",
    "why_skipped": "A rep is actively at a door for the duration; screen-on during an intentional recording is expected, and it directly prevents the 'it stopped' failure. Released the instant recording ends.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T07:24:00+08:00",
    "outcome": "Accepted; released on stop/teardown so it never outlives a recording."
  }
]
```
