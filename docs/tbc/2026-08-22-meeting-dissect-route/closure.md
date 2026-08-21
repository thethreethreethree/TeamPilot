# CLOSURE — Meeting Dissect route (the trigger)

## What shipped
`POST /api/coach/meeting-session/[id]/dissect` — the post-meeting review trigger. Owner-gated, meeting/huddle
only; returns a cached dissect event without re-charging, else transcribes the durable audio with N-party
diarization → generate-and-stores → returns. maxDuration 300. New route + 7 tests; full `npm run check` exit 0
(3588 tests); no sales/server change. The Dissect is now reachable end-to-end (measurement + store + trigger);
only the human-facing UI + the trend aggregate remain.

## The un-named reliance
- **ElevenLabs batch STT + diarization.** The transcription leg calls the live provider (same as sales
  retranscribe) — device/integration-confirmed; the route's control flow is unit-tested against mocks.
- **The durable audio existing.** Returns 409 until the audio is stitched/persisted (handled honestly).

## Open (final Dissect increments)
1. The post-meeting review UI — render `{dissect}` (decisions / owned-actions / open-items / effectiveness) on
   the meeting session, with a "generate review" action for the first call.
2. The per-team improvement-TREND aggregate over `meeting.dissect_generated` events (no control baseline — audit).
3. RLS: the review read-path must decide owner-vs-company visibility for the dissect payload (audit Layer-3).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "no-retranscribe-cache-table",
    "item": "Unlike sales retranscribe (coaching_retranscribe_cache), this route caches only via the stored dissect EVENT, not the raw diarized transcript.",
    "why_skipped": "The meeting review's product is the DISSECT, not the raw transcript; once the dissect event exists the route short-circuits before any STT, so the expensive leg is already cached. Caching the raw transcript too would only help a ?force=1 re-generate, which is rare.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T01:08:00+08:00",
    "outcome": "Examined the cost path: the STT charge happens ONLY on the first dissect (no event yet) or an explicit ?force=1. The stored-event cache covers every normal re-view at zero STT cost. A raw-transcript cache would add a table + write for a marginal ?force case — not worth it now; revisit only if force-regenerate becomes common."
  }
]
```
