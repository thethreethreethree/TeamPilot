# CLOSURE — Meeting Dissect review-fix pass

## What shipped
Five correctness fixes from an independent adversarial review of the Dissect: the HIGH cost-loop (the
`dissect_attempted` marker was a dead write — now the route reads it and backs off), the trend event-vs-meeting
dedup, the history-list kind-filter-in-the-query, the `MeetingReview` unmount guard, and the `"null"`-owner
honesty. Full `npm run check` exit 0 (3602 tests); no sales/server behavior change.

## The un-named reliance
- **The review's coverage.** One reviewer found 5; a device run could surface UI-glue issues the unit tests
  can't. The review confirmed the server/data layer + the fresh-vs-cached payload shape as CLEAN.
- **Device confirmation** for the UI-glue fix (MeetingReview guard).

## Open (next)
1. Integrate the `speakerBalance` util (written, standalone) into the dissect as a proposed measurement field —
   the plan's imbalance monitor, realized post-hoc from the diarized transcript.
2. Founder sign-off on the proposed measurement + trend heuristic; nav placement (Team-Sync).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "attempted-marker-never-clears",
    "item": "Once a meeting has a dissect_attempted marker, the route returns empty forever (until ?force=1) — even if the audio is later re-stitched into something transcribable.",
    "why_skipped": "A meeting's audio is fixed once stitched; a dissect_attempted means the transcription of THAT audio found nothing to capture, which won't change on re-run. ?force=1 exists for the rare 'the first pass was garbled' case.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T02:58:00+08:00",
    "outcome": "Examined: the audio is immutable once persisted/stitched, so re-transcribing the same bytes yields the same no-signal — caching that verdict is correct, exactly like the sales retranscribe cache keys on audio_asset_url. The only real 'it changed' case is a re-upload (which meetings don't have) or a transient STT hiccup (covered by ?force=1). Correct to cache; not a staleness bug."
  }
]
```
