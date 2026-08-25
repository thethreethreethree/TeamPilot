# CLOSURE — iOS empty-capture ROOT: force chunks via requestData()

## What shipped
The Door Log recorder now forces a chunk via `requestData()` on an interval whenever the MediaRecorder timeslice
hasn't delivered one — the documented workaround for iOS Safari IGNORING `start(timeslice)`. This makes the
incremental chunk upload actually engage on iOS (previously `chunksUploaded=0` on every iOS recording), so partial
audio is durable from ~15s and survives the mic-track ending mid-pitch. Grounded in telemetry: 12/12 recent empty
captures were iOS, all `chunksUploaded=0`, webm.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Real-hook test gates the force-on-silent-timeslice behavior; 23 existing
doorlog tests unchanged. Authoritative proof is a live iOS device (the founder's).

## The un-named reliance
- **iOS Safari honors `requestData()` even though it ignores `start(timeslice)`, and its forced blob is a valid
  continuation chunk.** This is the documented iOS behavior the fix rests on; if a given iOS version also mis-handled
  requestData, the clean-Stop full blob remains the fallback (no regression vs today). Confirmed only by the founder's
  live device test.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "WHY the iOS mic track ends mid-pitch on long recordings (trackReadyState=ended, while wakeLock=true / not hidden) is not root-caused — candidates: iOS audio-session conflict with the sound-bar AudioContext, or iOS resource limits on long getUserMedia captures.",
    "why_skipped": "This fix recovers the audio REGARDLESS of why the track ends (forced chunks make pre-end audio durable), so the loss is addressed without the root cause. Root-causing the track-end needs a live iOS device + repro (device-gated). If chunks show the track consistently dies at a fixed point, the next lever is dropping the sound-bar AudioContext on iOS to test the audio-session-conflict hypothesis.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-26T04:00:00+08:00",
    "outcome": "OPENED + bounded: with forced chunks, a track that ends at minute 3 of a pitch still yields ~3 minutes of durable audio (vs 0 today). So the founder-facing loss is fixed even if the track still ends; the track-end root is a follow-up quality improvement, not a blocker for recovering the recording. Verify from the next iOS captures whether chunkCount now rises before the end."
  },
  {
    "id": "R2",
    "item": "The live/meeting recorders share the timeslice pattern but were not changed here.",
    "why_skipped": "Initially deferred, then SWEPT same-session: grep confirmed exactly 3 non-test start(timeslice) callers (doorlog + useLiveCoaching:1231 + useMeetingCoaching:381), so the same inert-on-non-iOS requestData force was applied to all 3 (A26 class boundary closed). Their fix is preventive (unexercised in telemetry) + inert on the non-iOS platforms they currently run on, so it cannot regress them; their review-recordings will now survive on iOS.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-26T04:12:00+08:00",
    "outcome": "OPENED + RESOLVED — swept to all 3 recorders. 557 coach v5 tests + 23 doorlog tests pass; typecheck clean. The DRY-extraction of the ~8-line self-guarding interval (now duplicated 3×) is a low-priority follow-up (drift risk low — self-contained + identical), not done to avoid churn on 2 live files under P0."
  }
]
```
