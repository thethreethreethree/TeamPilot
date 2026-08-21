# CLOSURE — Meeting call-audio durability

## What shipped
Client-only: `useMeetingCoaching` now records the call and makes the audio durable by REUSING the sales
infrastructure (the `/audio-chunk` route, `persistRecording`, the stitch + purge crons) — no new server code. A
meeting's audio now survives a dropped feed / never-Stop / crash, so the meeting is recoverable and Phase-6
Dissect has material. Full `npm run check` exit 0 (3572 tests); no sales/server change.

## The un-named reliance
- **The reused routes serving a meeting caller.** `/audio-chunk` + `upload-recording/*` (via persistRecording)
  are owner-gated on the coaching_sessions row and session-generic; assumed to serve a meeting facilitator the
  same as a rep. Confirm on device.
- **Migration 0237 + the crons.** No meeting session exists until 0237 is applied; the stitch/purge crons run on
  their existing schedule over all coaching_sessions.
- **Device confirmation.** The recorder path is not unit-testable.

## Open (unchanged)
Apply 0237 + device validation; nav + module gating (product-structure decision); diarization; video/platform
captions; post-meeting Dissect surface (the audio this build saves is its input).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "reconnect-recorder-gap",
    "item": "The recorder is created on fresh start only; if the mic track dies mid-meeting and a new stream is acquired on reconnect, post-loss audio is not recorded.",
    "why_skipped": "One recorder = one valid webm (no seam to reason about). The full recorder-recreate seam handling (recorderRecreatedRef + onstop header scan) the sales hook has is real complexity; a meeting on a stable room network rarely loses the track, and the pre-loss audio + transcript survive.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T00:11:00+08:00",
    "outcome": "Examined the tradeoff against the sales hook: the sales seam handling exists because reps are mobile/door-to-door (frequent screen-lock track loss); a meeting facilitator is typically stationary. The pre-loss recording + the live transcript both survive a track death. Adopting the full seam path is a clean follow-up if device testing shows meetings lose tracks often. Left as the documented MVP limit, not a defect."
  },
  {
    "id": "no-audio-length-capture",
    "item": "The meeting recording doesn't capture the real audio length from transcription word-timestamps the way an uploaded sales recording does (audio_duration_seconds).",
    "why_skipped": "Live meetings use started..ended wall-clock for duration (correct for a live session); the word-timestamp length matters for UPLOADED recordings, which meetings don't have yet.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
