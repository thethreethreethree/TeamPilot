# CLOSURE — Door Log: skip naming when capture produced no audio

## What shipped
Completes the capture-loss trust fix (506a93d0): when audio capture yields no blob, picking the outcome now
logs the disposition as a knock and returns home directly — no phantom "Name this pitch" screen for a pitch
that does not exist — with the honest amber "no audio to review" note. Consolidated the three near-identical
"log an outcome as a knock, go home" paths into one `logKnockOutcome(outcome, { audioDropped })` helper.

`save()`'s knock fallback is retained for the LATE failure it still owns (a blob that existed at pick but whose
upload fails at save). No server, state-machine, or sales change. Full `npm run check` exit 0.

## The un-named reliance
- **Device confirmation** (same as the parent fix): a real phone losing the recorder mid-pitch → the rep picks
  an outcome and lands home with the amber note, no naming detour. jsdom render test proves the logic.

## Residual (A36)

```json
[
  {
    "id": "save-null-blob-branch-now-ui-unreachable",
    "item": "sendPitch's null-blob knock fallback is no longer reachable via the UI for the CAPTURE-loss case (pickOutcome intercepts it earlier); it still fires for the UPLOAD-failure case.",
    "why_skipped": "It remains correct + covered defense-in-depth for the upload-failure path and a defensive null. Removing it would narrow the safety net for no gain.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T04:33:00+08:00",
    "outcome": "Kept intentionally as defense-in-depth; the DoorLogSaveResilience test exercises the real-blob path through save()."
  }
]
```
